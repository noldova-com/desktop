/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { execFile } from "node:child_process";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import "@noldova/context.core";
import { BatchArgumentRefusedException, BatchSystemRootMissingException, ProcessRequest } from "@noldova/desktop.runtime";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import type { ProcessLaunch } from "../../../src/models/process-launch.js";
import { ProcessEnvironment } from "../../../src/services/process/process-environment.js";
import { ProgramLaunchResolver } from "../../../src/services/process/program-launch-resolver.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProgramLaunchResolverTests {
  private static readonly HEAD: readonly string[] = ["@ECHO off", "GOTO start", ":find_dp0", "SET dp0=%~dp0", "EXIT /b", ":start", "SETLOCAL", "CALL :find_dp0"];
  private static readonly NODE_SHIM: string = ProgramLaunchResolverTests.nodeShim("\"%dp0%\\..\\tool\\bin\\tool.js\"");
  private static readonly UNTRACED_SHIMS: Readonly<Record<string, readonly [string, string]>> = {
    "empty": [String.empty, String.empty],
    "one line with a fixed flag": ["@\"%~dp0\\tool.exe\" --flag %*\r\n", "tool.exe"],
    "one line after a SET line": ["@SET X=1\r\n@\"%~dp0\\tool.exe\" %*\r\n", "tool.exe"],
    "node named in the line": ["@node \"%~dp0\\tool.js\" %*\r\n", "tool.js"],
    "node shim with a fixed flag": [ProgramLaunchResolverTests.nodeShim("--flag \"%dp0%\\tool.js\""), "tool.js"],
    "node shim with a variable": [ProgramLaunchResolverTests.nodeShim("\"%dp0%\\tool.js\"", ["@SET FOO=bar"]), "tool.js"],
    "node shim for a program": [ProgramLaunchResolverTests.nodeShim("\"%dp0%\\tool.exe\""), "tool.exe"],
    "program shim with a fixed flag": [ProgramLaunchResolverTests.programShim("\"%dp0%\\tool.exe\" --flag"), "tool.exe"],
    "program shim for a script": [ProgramLaunchResolverTests.programShim("\"%dp0%\\tool.js\""), "tool.js"],
    "older node shim": [[
      "@IF EXIST \"%~dp0\\node.exe\" (", "  \"%~dp0\\node.exe\"  \"%~dp0\\tool\" %*", ") ELSE (",
      "  @SETLOCAL", "  @SET PATHEXT=%PATHEXT:;.JS;=;%", "  node  \"%~dp0\\tool\" %*", ")"].join("\r\n"), "tool"]
  };

  @TestMethod
  @TestData("linux", "tool.cmd")
  @TestData("win32", "tool.exe")
  @TestData("win32", "tool.js")
  public async startsAnythingButAWindowsBatchFileAsItIs(platform: string, name: string): Promise<void> {
    const file = path.join("folder", name);

    Assert.areEqual(`${file}|a b|false`, ProgramLaunchResolverTests.format(await ProgramLaunchResolverTests.resolveAsync(file, ["a b"], {}, platform)));
  }

  @TestMethod
  @TestData("win32", true)
  @TestData("linux", false)
  @TestData("darwin", false)
  public async launchesVerbatimArgumentsAsTheyAreOnlyOnWindows(platform: string, isVerbatim: boolean): Promise<void> {
    const file = path.join("folder", "cmd.exe");

    const launch = await ProgramLaunchResolverTests.resolveAsync(file, ["/c", "\"a b\""], {}, platform, true);

    Assert.areEqual(`${file}|/c|"a b"|${isVerbatim}`, ProgramLaunchResolverTests.format(launch));
    Assert.areEqual(isVerbatim ? `"${file}"` : file, launch.programArgument);
  }

  @TestMethod
  @TestData("tool.cmd")
  @TestData("TOOL.BAT")
  public async startsOnlyTheProgramABatchFileRunsAndNotOneBesideItWithItsName(name: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, name);
    const other = path.join(folder.path, "other.exe");
    for (const created of [other, path.join(folder.path, `${path.parse(name).name}.exe`)])
      await writeFile(created, String.empty);
    await writeFile(file, "@\"%~dp0\\other.exe\" %*\r\n");

    Assert.areEqual(`${other}|a|false`, ProgramLaunchResolverTests.format(await ProgramLaunchResolverTests.resolveAsync(file, ["a"])));
  }

  @TestMethod
  public async startsTheProgramACmdShimWithoutAShebangRuns(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const bin = path.join(folder.path, "bin");
    const tool = path.join(folder.path, "tool");
    for (const created of [bin, tool])
      await mkdir(created);
    const file = path.join(bin, "tool.cmd");
    const program = path.join(tool, "tool.exe");
    await writeFile(file, ProgramLaunchResolverTests.programShim("\"%dp0%\\..\\tool\\tool.exe\""));
    await writeFile(program, String.empty);

    Assert.areEqual(`${program}|a|false`, ProgramLaunchResolverTests.format(await ProgramLaunchResolverTests.resolveAsync(file, ["a"])));
  }

  @TestMethod
  public async failsWhenTheBatchFileCannotBeReadForAnotherReasonThanBeingMissing(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "tool.cmd");
    await mkdir(file);

    const error = await Assert.throwsAsync(() => ProgramLaunchResolverTests.resolveAsync(file, ["a"]), Error);

    Assert.isTrue(error.message.startsWith("EISDIR"), error.message);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async failsWhenTheProgramABatchFileRunsCannotBeReadForAnotherReasonThanBeingMissing(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const bin = path.join(folder.path, "bin");
    const tool = path.join(folder.path, "tool");
    for (const created of [bin, tool])
      await mkdir(created);
    const file = path.join(bin, "tool.cmd");
    const program = path.join(tool, "tool.exe");
    await writeFile(file, ProgramLaunchResolverTests.programShim("\"%dp0%\\..\\tool\\tool.exe\""));
    await symlink(program, program);

    const error = await Assert.throwsAsync(() => ProgramLaunchResolverTests.resolveAsync(file, ["a"]), Error);

    Assert.isTrue(error.message.startsWith("ELOOP"), error.message);
  }

  @TestMethod
  public async failsWhenTheProgramABatchFileRunsHasANameNoPathCanHold(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "tool.cmd");
    await writeFile(file, "@\"%~dp0\\to\u0000ol.exe\" %*\r\n");

    const error = await Assert.throwsAsync(() => ProgramLaunchResolverTests.resolveAsync(file, ["a"]), Error);

    Assert.isTrue(error.message.includes("null bytes"), error.message);
  }

  @TestMethod
  public async startsTheNativeProgramABatchFileRunsWithEveryArgumentAsItIs(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const shims = path.join(folder.path, "shims");
    const bin = path.join(folder.path, "bin");
    for (const created of [shims, bin])
      await mkdir(created);
    const file = path.join(shims, "tool.cmd");
    await writeFile(file, "@\"%~dp0\\..\\bin\\Tool.EXE\"  %*\r\n");
    await writeFile(path.join(bin, "Tool.EXE"), String.empty);

    const launch = await ProgramLaunchResolverTests.resolveAsync(file, ["100%", "\"q\"", "!x!", "two\nlines"]);

    Assert.areEqual(`${path.join(bin, "Tool.EXE")}|100%|"q"|!x!|two\nlines|false`, ProgramLaunchResolverTests.format(launch));
  }

  @TestMethod
  public async startsTheScriptABatchFileRunsWithTheNodeBesideIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const bin = path.join(folder.path, "node_modules", ".bin");
    const tool = path.join(folder.path, "node_modules", "tool", "bin");
    for (const created of [bin, tool])
      await mkdir(created, { recursive: true });
    const file = path.join(bin, "tool.cmd");
    const script = path.join(tool, "tool.js");
    await writeFile(file, ProgramLaunchResolverTests.NODE_SHIM);
    for (const created of [path.join(bin, "node.exe"), script])
      await writeFile(created, String.empty);

    const launch = await ProgramLaunchResolverTests.resolveAsync(file, ["%PATH%", "\"q\"", "!x!"]);

    Assert.areEqual(`${path.join(bin, "node.exe")}|${script}|%PATH%|"q"|!x!|false`, ProgramLaunchResolverTests.format(launch));
  }

  @TestMethod
  public async startsTheScriptABatchFileRunsWithTheNodeOnThePath(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const bin = path.join(folder.path, "node_modules", ".bin");
    const tool = path.join(folder.path, "node_modules", "tool", "bin");
    const runtime = path.join(folder.path, "node_modules", "runtime");
    for (const created of [bin, tool, runtime])
      await mkdir(created, { recursive: true });
    const file = path.join(bin, "tool.cmd");
    const script = path.join(tool, "tool.js");
    await writeFile(file, ProgramLaunchResolverTests.NODE_SHIM);
    for (const created of [script, path.join(runtime, "node.exe")])
      await writeFile(created, String.empty);

    const launch = await ProgramLaunchResolverTests.resolveAsync(file, ["a"], { Path: runtime, PATHEXT: ".EXE" });

    Assert.areEqual(`${path.join(runtime, "node.exe")}|${script}|a|false`, ProgramLaunchResolverTests.format(launch));
  }

  @TestMethod
  @TestData("empty")
  @TestData("one line with a fixed flag")
  @TestData("one line after a SET line")
  @TestData("node named in the line")
  @TestData("node shim with a fixed flag")
  @TestData("node shim with a variable")
  @TestData("node shim for a program")
  @TestData("program shim with a fixed flag")
  @TestData("program shim for a script")
  @TestData("older node shim")
  public async runsThroughCmdABatchFileThatIsNotExactlyAKnownShim(variant: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const [shim, target] = ProgramLaunchResolverTests.UNTRACED_SHIMS[variant] ?? [String.empty, String.empty];
    const file = path.join(folder.path, "tool.cmd");
    await writeFile(file, shim);
    if (!String.isNullOrEmpty(target))
      await writeFile(path.join(folder.path, target), String.empty);
    await writeFile(path.join(folder.path, "node.exe"), String.empty);
    const systemRoot = path.join(folder.path, "windows");

    const launch = await ProgramLaunchResolverTests.resolveAsync(file, ["a"], { SystemRoot: systemRoot });

    Assert.areEqual(`${path.win32.join(systemRoot, "System32", "cmd.exe")}|true`, `${launch.executable}|${launch.isVerbatim}`);
  }

  @TestMethod
  @TestData(null, String.empty)
  @TestData("@echo off\r\nset x=1\r\n", String.empty)
  @TestData("@echo %*\r\n", String.empty)
  @TestData("@\"%~dp0\\missing.exe\" %*\r\n", String.empty)
  @TestData("@\"%~dp0\\tool.ps1\" %*\r\n", "tool.ps1")
  @TestData("@python \"%~dp0\\tool\" %*\r\n", "tool")
  public async runsABatchFileItCannotTraceThroughCmdWithEachArgumentEscapedTwice(shim: string | null, target: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "run (1).cmd");
    if (!Object.isNull(shim))
      await writeFile(file, shim);
    if (!String.isNullOrEmpty(target))
      await writeFile(path.join(folder.path, target), String.empty);
    const systemRoot = path.join(folder.path, "windows");

    const launch = await ProgramLaunchResolverTests.resolveAsync(file, ["a b", "x&y", "back\\", String.empty], { SystemRoot: systemRoot });

    const line = launch.arguments.at(-1);
    Assert.areEqual(`${path.win32.join(systemRoot, "System32", "cmd.exe")}|/d|/s|/c`, [launch.executable, ...launch.arguments.slice(0, 3)].join("|"));
    Assert.areEqual(4, launch.arguments.length);
    Assert.isTrue(launch.isVerbatim);
    Assert.isTrue(line?.startsWith("\"") === true, line);
    Assert.isTrue(line?.endsWith("run^ ^(1^).cmd ^^^\"a^^^ b^^^\" ^^^\"x^^^&y^^^\" ^^^\"back\\\\^^^\" ^^^\"^^^\"\"") === true, line);
  }

  @TestMethod
  @TestData("100%")
  @TestData("say \"hi\"")
  @TestData("!x!")
  @TestData("two\nlines")
  @TestData("return\r")
  @TestData("nul\0")
  public async refusesAnArgumentCmdCannotCarryToABatchFileItCannotTrace(value: string): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "run.bat");
    await writeFile(file, "@echo %*\r\n");

    const exception = await Assert.throwsAsync(() => ProgramLaunchResolverTests.resolveAsync(file, ["plain", value]), BatchArgumentRefusedException);

    Assert.areEqual(
      `${file} is a batch file whose program could not be traced, and cmd.exe cannot be given an argument that holds %, ", !, a line break or a NUL character.`,
      exception.message);
  }

  @TestMethod
  @TestData(null)
  @TestData(String.empty)
  @TestData(" ")
  public async refusesABatchFileItCannotTraceWithoutSystemRoot(systemRoot: string | null): Promise<void> {
    const runtime: NodeJS.ProcessEnv = Object.isNull(systemRoot) ? {} : { SystemRoot: systemRoot };

    const exception = await Assert.throwsAsync(() => ProgramLaunchResolverTests.resolveAsync(path.join("missing", "run.cmd"), [], runtime), BatchSystemRootMissingException);

    Assert.areEqual("SystemRoot is not set, so the Windows system tools cannot be found.", exception.message);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async passesEachArgumentThroughCmdUnchanged(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const spaced = path.join(folder.path, "with space (1)");
    await mkdir(spaced);
    const script = path.join(spaced, "echo.mjs");
    const file = path.join(spaced, "echo.cmd");
    await writeFile(script, "process.stdout.write(JSON.stringify(process.argv.slice(2)));\n");
    await writeFile(file, `@"${process.execPath}" "${script}" %*\r\n`);
    const launchArguments = ["a b", "x&y", "back\\", String.empty, "mid\\dle", "^caret", "semi;colon", "a,b", "<in>|out", "(x)"];

    const launch = await ProgramLaunchResolverTests.resolveAsync(file, launchArguments, process.env);
    const { stdout } = await promisify(execFile)(launch.executable, [...launch.arguments], { windowsVerbatimArguments: launch.isVerbatim });

    Assert.isTrue(launch.isVerbatim);
    Assert.areEqual(JSON.stringify(launchArguments), stdout);
  }

  private static nodeShim(call: string, variables: readonly string[] = []): string {
    return [
      ...ProgramLaunchResolverTests.HEAD, ...variables, String.empty, "IF EXIST \"%dp0%\\node.exe\" (", "  SET \"_prog=%dp0%\\node.exe\"", ") ELSE (", "  SET \"_prog=node\"",
      "  SET PATHEXT=%PATHEXT:;.JS;=;%", ")", String.empty, `endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  ${call} %*`, String.empty].join("\r\n");
  }

  private static programShim(call: string): string {
    return [...ProgramLaunchResolverTests.HEAD, `${call}   %*`, String.empty].join("\r\n");
  }

  private static resolveAsync(file: string, launchArguments: readonly string[], runtime: NodeJS.ProcessEnv = { SystemRoot: "windows" }, platform: string = "win32",
    isVerbatim: boolean = false): Promise<ProcessLaunch> {
    const environment = ProcessEnvironment.create(platform, runtime, new ProcessRequest(file, launchArguments, path.resolve(path.dirname(file))));
    return new ProgramLaunchResolver(platform, runtime).resolveAsync(file, launchArguments, environment, isVerbatim);
  }

  private static format(launch: ProcessLaunch): string {
    return [launch.executable, ...launch.arguments, String(launch.isVerbatim)].join("|");
  }
}
