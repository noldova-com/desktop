/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";
import { chmod, mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  ProcessRequest,
  type ProcessStartException,
  ProcessStartFailedException,
  ProgramNotFoundException,
  ProgramPathRelativeException
} from "@noldova/desktop.runtime";

import { ProcessEnvironment } from "../../../src/services/process/process-environment.js";
import { ProgramLocator } from "../../../src/services/process/program-locator.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { StatsFixture } from "../../fixtures/stats.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

type SkippedVariant = "a link to nothing" | "a link loop" | "a folder" | "a refused file that is not a link" | "a refused link that lstat cannot read" | "a refused link";
type ReadStats = (file: string) => Promise<Stats>;

@TestClass
export class ProgramLocatorTests {
  private static readonly LINK: Stats = new StatsFixture("link");
  private static readonly FILE: Stats = new StatsFixture("file");
  private static readonly FOLDER: Stats = new StatsFixture("folder");
  private static readonly FAKES: Readonly<Record<SkippedVariant, readonly [ReadStats, ReadStats]>> = {
    "a link to nothing": [async () => ProgramLocatorTests.refuse("ENOENT"), async () => ProgramLocatorTests.LINK],
    "a link loop": [async () => ProgramLocatorTests.refuse("ELOOP"), async () => ProgramLocatorTests.LINK],
    "a folder": [async () => ProgramLocatorTests.FOLDER, async () => ProgramLocatorTests.FOLDER],
    "a refused file that is not a link": [async () => ProgramLocatorTests.refuse("EACCES"), async () => ProgramLocatorTests.FILE],
    "a refused link that lstat cannot read": [async () => ProgramLocatorTests.refuse("EACCES"), async () => ProgramLocatorTests.refuse("EACCES")],
    "a refused link": [async () => ProgramLocatorTests.refuse("EPERM"), async () => ProgramLocatorTests.LINK]
  };

  @TestMethod
  public async findsAWindowsProgramByEachRunnablePathExtExtensionInOrderPastFoldersWithVariableNamesInAnyCase(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const first = path.join(folder.path, "first");
    const second = path.join(folder.path, "second");
    const named = path.join(folder.path, "named");
    await mkdir(first);
    await mkdir(second);
    await mkdir(path.join(named, "tool.exe"), { recursive: true });
    for (const file of [path.join(first, "tool.cmd"), path.join(first, "tool.exe"), path.join(first, "tool.js"), path.join(first, "other.bat"), path.join(first, "script.js"), path.join(second, "tool.exe")])
      await writeFile(file, String.empty);
    const runtime: NodeJS.ProcessEnv = { Path: first, SystemRoot: path.join(folder.path, "missing") };
    const locateAsync = async (
      exceptionType: new (...arguments_: never[]) => ProcessStartException,
      environment: NodeJS.ProcessEnv,
      program: string,
      variables: Readonly<Record<string, string>> = {}): Promise<string> => {
      const processes = ProcessSupervisorFixture.create(settings, "win32", environment);
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(program, [], folder.path, variables)), exceptionType)).message;
    };
    const failed = ProcessStartFailedException;

    Assert.areEqual(`${path.join(first, "tool.cmd")} could not be started.`, await locateAsync(failed, { ...runtime, PATHEXT: ".CMD;.EXE" }, "tool"));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync(failed, { ...runtime, PATHEXT: ".Exe;;.CMD" }, "tool"));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync(failed, runtime, "tool"));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync(failed, { ...runtime, PATHEXT: " " }, "tool"));
    Assert.areEqual(`${path.join(first, "other.bat")} could not be started.`, await locateAsync(failed, runtime, "other"));
    Assert.areEqual(`${path.join(first, "tool.cmd")} could not be started.`, await locateAsync(failed, { ...runtime, PATHEXT: ".EXE" }, "tool.cmd"));
    Assert.areEqual(`${path.join(second, "tool.exe")} could not be started.`, await locateAsync(failed, runtime, "tool", { PATH: second }));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync(failed, { ...runtime, Path: [named, first].join(";") }, "tool"));
    Assert.areEqual(`${path.join(first, "tool.exe")} could not be started.`, await locateAsync(failed, { ...runtime, PATHEXT: ".JS; .Exe " }, "tool"));
    Assert.areEqual(
      "script.js was not found, or it is not a program that can be run.",
      await locateAsync(ProgramNotFoundException, { ...runtime, PATHEXT: ".JS;.EXE" }, "script.js"));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  public async findsAWindowsProgramThroughAQuotedPathEntryThatMayHoldASemicolon(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const plain = path.join(folder.path, "plain");
    const separated = path.join(folder.path, "tools;more");
    await mkdir(plain);
    await mkdir(separated);
    await writeFile(path.join(plain, "plain.exe"), String.empty);
    await writeFile(path.join(separated, "only.exe"), String.empty);
    const locateAsync = async (exceptionType: new (...arguments_: never[]) => ProcessStartException, searchPath: string, program: string): Promise<string> => {
      const processes = ProcessSupervisorFixture.create(settings, "win32", { Path: searchPath, SystemRoot: path.join(folder.path, "missing") });
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(program, [], folder.path)), exceptionType)).message;
    };
    const failed = ProcessStartFailedException;

    Assert.areEqual(`${path.join(separated, "only.exe")} could not be started.`, await locateAsync(failed, `${plain};"${separated}"`, "only"));
    Assert.areEqual(`${path.join(separated, "only.exe")} could not be started.`, await locateAsync(failed, `"${separated}";${plain}`, "only"));
    Assert.areEqual(`${path.join(plain, "plain.exe")} could not be started.`, await locateAsync(failed, `"${separated}";"${plain}"`, "plain"));
    Assert.areEqual(`${path.join(separated, "only.exe")} could not be started.`, await locateAsync(failed, `${plain};"${separated}`, "only"));
    Assert.areEqual(`${path.join(plain, "plain.exe")} could not be started.`, await locateAsync(failed, `${path.join(folder.path, "missing")}";${plain}"`, "plain"));
    Assert.areEqual("only was not found, or it is not a program that can be run.", await locateAsync(ProgramNotFoundException, `${plain};${separated}`, "only"));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async skipsFoldersFilesThatCannotRunLinksToNothingAndLinkLoopsWhenItSearchesThePath(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const named = path.join(folder.path, "named");
    const plain = path.join(folder.path, "plain");
    const dangling = path.join(folder.path, "dangling");
    const looped = path.join(folder.path, "looped");
    const runnable = path.join(folder.path, "runnable");
    for (const directory of [named, plain, dangling, looped, runnable])
      await mkdir(directory);
    await mkdir(path.join(named, "tool"));
    await writeFile(path.join(plain, "tool"), String.empty);
    await chmod(path.join(plain, "tool"), 0o644);
    await symlink(path.join(dangling, "missing"), path.join(dangling, "tool"));
    await symlink(path.join(looped, "tool"), path.join(looped, "tool"));
    await symlink(process.execPath, path.join(runnable, "tool"));
    const processes = ProcessSupervisorFixture.create(settings, process.platform, { PATH: ["relative", named, plain, dangling, looped, runnable].join(":") });

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest("tool", [ProgramFixture.file, ProgramFixture.EXIT, "0"], folder.path));
    await owned.exited;

    Assert.areEqual(path.join(runnable, "tool"), owned.program);
  }

  @TestMethod
  @TestData("EACCES")
  @TestData("EPERM")
  public async findsAWindowsAppExecutionAliasThatStatRefusesWhenLstatReadsItAsALink(code: string): Promise<void> {
    const alias = path.resolve("WindowsApps", "pwsh.exe");
    const locator = new ProgramLocator("win32", async t => ProgramLocatorTests.refuse(t === alias ? code : "ENOENT"), async () => ProgramLocatorTests.LINK);
    const locateAsync = (program: string): Promise<string> =>
      locator.locateAsync(program, ProcessEnvironment.create("win32", { Path: path.dirname(alias) }, new ProcessRequest(program, [], path.dirname(alias))));

    Assert.areEqual(alias, await locateAsync(alias));
    Assert.areEqual(alias, await locateAsync("pwsh"));
  }

  @TestMethod
  public async failsWhenLstatFailsForAnUnmodeledReason(): Promise<void> {
    const program = path.resolve("WindowsApps", "pwsh.exe");
    const locator = new ProgramLocator("win32", async () => ProgramLocatorTests.refuse("EACCES"), async () => ProgramLocatorTests.refuse("EIO"));

    const error = await Assert.throwsAsync(() => locator.locateAsync(program, ProcessEnvironment.create("win32", {}, new ProcessRequest(program, [], path.dirname(program)))), Error);

    Assert.areEqual("EIO: the file system refused the file.", error.message);
  }

  @TestMethod
  @TestData("win32", "a link to nothing")
  @TestData("win32", "a link loop")
  @TestData("win32", "a folder")
  @TestData("win32", "a refused file that is not a link")
  @TestData("win32", "a refused link that lstat cannot read")
  @TestData("linux", "a refused link")
  public async skipsWhatStatRefusesOrReadsAsNoFileUnlessItIsAWindowsLink(platform: string, variant: SkippedVariant): Promise<void> {
    const [stat, lstat] = ProgramLocatorTests.FAKES[variant];
    const program = path.resolve("WindowsApps", "pwsh.exe");
    const locator = new ProgramLocator(platform, stat, lstat);

    const exception = await Assert.throwsAsync(() => locator.locateAsync(program, ProcessEnvironment.create(platform, {}, new ProcessRequest(program, [], path.dirname(program)))), ProgramNotFoundException);

    Assert.areEqual(`${program} was not found, or it is not a program that can be run.`, exception.message);
  }

  @TestMethod
  public async refusesARelativePathAndAProgramItCannotFind(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const startAsync = async (
      exceptionType: new (...arguments_: never[]) => ProcessStartException,
      platform: string,
      environment: NodeJS.ProcessEnv,
      program: string): Promise<string> => {
      const processes = ProcessSupervisorFixture.create(settings, platform, environment);
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(program, [], folder.path)), exceptionType)).message;
    };
    const missing = path.join(folder.path, "missing-tool");
    const relative = ProgramPathRelativeException;
    const notFound = ProgramNotFoundException;

    Assert.areEqual("bin/tool is neither a program's name nor an absolute path.", await startAsync(relative, "linux", { PATH: folder.path }, "bin/tool"));
    Assert.areEqual("bin\\tool is neither a program's name nor an absolute path.", await startAsync(relative, "win32", { PATH: folder.path }, "bin\\tool"));
    Assert.areEqual("\\tool is neither a program's name nor an absolute path.", await startAsync(relative, "win32", { PATH: folder.path }, "\\tool"));
    Assert.areEqual("C:tool is neither a program's name nor an absolute path.", await startAsync(relative, "win32", { PATH: folder.path }, "C:tool"));
    Assert.areEqual(
      "missing-tool was not found, or it is not a program that can be run.",
      await startAsync(notFound, "linux", { PATH: `relative:${folder.path}` }, "missing-tool"));
    Assert.areEqual("missing-tool was not found, or it is not a program that can be run.", await startAsync(notFound, "win32", {}, "missing-tool"));
    Assert.areEqual(`${missing} was not found, or it is not a program that can be run.`, await startAsync(notFound, "linux", {}, missing));
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }

  private static refuse(code: string): never {
    throw Object.assign(new Error(`${code}: the file system refused the file.`), { code });
  }
}
