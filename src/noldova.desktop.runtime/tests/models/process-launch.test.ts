/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessRequest, VerbatimBatchRefusedException } from "@noldova/desktop.runtime";

import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { ProcessSupervisorFixture } from "../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../fixtures/program.fixture.js";
import { SettingsFixture } from "../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";
import { WindowsProcessApiFixture } from "../fixtures/windows-process-api.fixture.js";

@TestClass
export class ProcessLaunchTests {
  @TestMethod
  @PlatformFixture.windowsOnly()
  public async passesEachArgumentCmdExeCanCarryToABatchFileItCannotTraceUnchanged(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const spaced = path.join(folder.path, "with space (1)");
    await mkdir(spaced);
    const file = path.join(spaced, "echo.cmd");
    await writeFile(file, `@"${process.execPath}" "${ProgramFixture.file}" ${ProgramFixture.ARGUMENTS} %*\r\n`);
    const launchArguments = ["a b", "x&y", "back\\", String.empty, "^caret", "semi;colon", "a,b", "<in>|out", "(x)"];
    const processes = ProcessSupervisorFixture.create(settings);

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest("echo", launchArguments, folder.path, { PATH: spaced }));
    const output = await ProgramFixture.readAllAsync(owned);

    Assert.areEqual(path.join(spaced, "echo.cmd"), owned.program);
    Assert.areEqual(JSON.stringify(launchArguments), output);
    Assert.isTrue((await owned.exited).isClean);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async passesVerbatimArgumentsSoCmdExeRunsACommandWithItsQuotesAsWritten(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const command = `"${process.execPath}" "${ProgramFixture.file}" ${ProgramFixture.ARGUMENTS} "a b" "x&y" plain`;
    const processes = ProcessSupervisorFixture.create(settings);

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest("cmd.exe", ["/d", "/s", "/c", `"${command}"`], folder.path, {}, [], undefined, true));
    const output = await ProgramFixture.readAllAsync(owned);

    Assert.areEqual(JSON.stringify(["a b", "x&y", "plain"]), output);
    Assert.isTrue((await owned.exited).isClean);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async quotesTheProgramsOwnPathAheadOfVerbatimArgumentsSoAFolderWithASpaceKeepsThemInPlace(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const spaced = path.join(folder.path, "Program Files (x86)");
    await mkdir(spaced);
    const program = path.join(spaced, "node.exe");
    await copyFile(process.execPath, program);
    const processes = ProcessSupervisorFixture.create(settings);

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE,
      new ProcessRequest(program, [`"${ProgramFixture.file}"`, ProgramFixture.ARGUMENTS, "\"a b\"", "plain"], folder.path, {}, [], undefined, true));
    const output = await ProgramFixture.readAllAsync(owned);

    Assert.areEqual(program, owned.program);
    Assert.areEqual(JSON.stringify(["a b", "plain"]), output);
    Assert.isTrue((await owned.exited).isClean);
  }

  @TestMethod
  public async refusesVerbatimArgumentsForAWindowsBatchFileTracedOrNotAndNamedOrFound(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const untraced = path.join(folder.path, "echo.cmd");
    const traced = path.join(folder.path, "TOOL.BAT");
    const found = path.join(folder.path, "run.cmd");
    for (const file of [untraced, found])
      await writeFile(file, "@echo %*\r\n");
    await writeFile(traced, "@\"%~dp0\\tool.exe\" %*\r\n");
    await writeFile(path.join(folder.path, "tool.exe"), String.empty);
    const processes = ProcessSupervisorFixture.createWindows(settings, new WindowsProcessApiFixture([]));
    const refuseAsync = async (file: string): Promise<string> => (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE,
      new ProcessRequest(file, ["a"], folder.path, { Path: folder.path, PATHEXT: ".EXE;.CMD" }, [], undefined, true)), VerbatimBatchRefusedException)).message;

    const refused = [await refuseAsync(untraced), await refuseAsync(traced), await refuseAsync("run")];

    Assert.areEqual(
      [untraced, traced, found].map(t => `${t} is a batch file, and a process request passes its arguments as they are only to a program that isn't one; give cmd.exe the batch file in its arguments instead.`).join("\n"),
      refused.join("\n"));
    Assert.areEqual(0, processes.programs.length);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async ignoresVerbatimArgumentsOnMacOSAndLinux(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const launchArguments = ["a b", "\"q\"", "back\\", "x&y", "echo.cmd"];
    const processes = ProcessSupervisorFixture.create(settings);

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(process.execPath, [ProgramFixture.file, ProgramFixture.ARGUMENTS, ...launchArguments], folder.path, {}, [], undefined, true));
    const output = await ProgramFixture.readAllAsync(owned);

    Assert.areEqual(JSON.stringify(launchArguments), output);
    Assert.isTrue((await owned.exited).isClean);
  }
}
