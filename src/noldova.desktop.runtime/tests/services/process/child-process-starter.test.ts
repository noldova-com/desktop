/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ChildProcessStarter, LaunchStartFailedException } from "@noldova/desktop.runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { PosixProcessApiFixture } from "../../fixtures/posix-process-api.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class ChildProcessStarterTests {
  private static readonly SHELL: string = "/bin/sh";
  private static readonly DESCRIPTOR_NODE_LEAVES_INHERITABLE: number = 20;
  private static readonly HANG_LIMIT: number = 20_000;
  private static readonly PROBE: string = [
    "const fs = require('node:fs');",
    "const [marker, result] = process.argv.slice(1);",
    "const target = fs.statSync(marker);",
    "let leaked = false;",
    "for (let descriptor = 0; descriptor < 1024; descriptor++) {",
    "  try { const found = fs.fstatSync(descriptor); leaked ||= found.ino === target.ino && found.dev === target.dev; } catch { }",
    "}",
    "fs.writeFileSync(result + '.partial', leaked ? 'leaked' : 'closed');",
    "fs.renameSync(result + '.partial', result);"
  ].join(" ");
  private static readonly HOLDER: string = [
    "const [runtime, probe, marker, result, errors] = process.argv.slice(2);",
    "const { ChildProcessStarter } = await import(runtime);",
    "await ChildProcessStarter.create(process.platform).startAsync(process.execPath, ['-e', probe, marker, result], process.env, errors);"
  ].join(" ");

  @TestMethod
  public startsTheCurrentPlatformsWayWhenCreatedWithoutArguments(): Promise<void> {
    return ChildProcessStarterTests.runStartAsync(new ChildProcessStarter());
  }

  @TestMethod
  public startsADetachedProgramWithNodesSpawnOnWindows(): Promise<void> {
    return ChildProcessStarterTests.runStartAsync(ChildProcessStarter.create("win32"));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public startsADetachedProgramThroughTheAddonOnPosix(): Promise<void> {
    return ChildProcessStarterTests.runStartAsync(ChildProcessStarter.create(process.platform));
  }

  @TestMethod
  public startsTheProgramInTheGivenWorkingFolderWithNodesSpawnOnWindows(): Promise<void> {
    return ChildProcessStarterTests.runFolderAsync(ChildProcessStarter.create("win32"));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public startsTheProgramInTheGivenWorkingFolderThroughTheAddonOnPosix(): Promise<void> {
    return ChildProcessStarterTests.runFolderAsync(ChildProcessStarter.create(process.platform));
  }

  @TestMethod
  public reportsAWorkingFolderThatDoesNotExistWithNodesSpawnOnWindows(): Promise<void> {
    return ChildProcessStarterTests.runMissingFolderAsync(ChildProcessStarter.create("win32"));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public reportsAWorkingFolderThatDoesNotExistThroughTheAddonOnPosix(): Promise<void> {
    return ChildProcessStarterTests.runMissingFolderAsync(ChildProcessStarter.create(process.platform));
  }

  @TestMethod
  public reportsAProgramThatCannotStartWithNodesSpawnOnWindows(): Promise<void> {
    return ChildProcessStarterTests.runMissingAsync(ChildProcessStarter.create("win32"));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public reportsAProgramThatCannotStartThroughTheAddonOnPosix(): Promise<void> {
    return ChildProcessStarterTests.runMissingAsync(ChildProcessStarter.create(process.platform));
  }

  @TestMethod
  @PlatformFixture.linuxOnly()
  public startsTheProgramInASessionOfItsOwnWithNodesSpawnOnLinux(): Promise<void> {
    return ChildProcessStarterTests.runSessionAsync(ChildProcessStarter.create("win32"));
  }

  @TestMethod
  @PlatformFixture.linuxOnly()
  public startsTheProgramInASessionOfItsOwnThroughTheAddonOnLinux(): Promise<void> {
    return ChildProcessStarterTests.runSessionAsync(ChildProcessStarter.create(process.platform));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public createsTheErrorFileForThePersonsAccountOnlyOnPosix(): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const processId = await ChildProcessStarter.create(process.platform).startAsync(ChildProcessStarterTests.SHELL, ["-c", "exit 0"], process.env, errorFile);

      Assert.isTrue(await WaitFixture.untilAsync(() => !ChildProcessStarterTests.isRunning(processId), ChildProcessStarterTests.HANG_LIMIT), "The program did not exit within 20 s.");
      Assert.areEqual(0o600, (await stat(errorFile)).mode & 0o777);
    });
  }

  @TestMethod
  public givesThePosixAddonTheProgramItsArgumentsItsEnvironmentAndTheErrorFile(): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const posix = new PosixProcessApiFixture(4_321);

      const processId = await new ChildProcessStarter("linux", posix).startAsync("/opt/tool/tool", ["--quiet"], { HOME: "/home/person", EMPTY: String.empty, UNSET: undefined }, errorFile);

      Assert.areEqual(4_321, processId);
      Assert.areEqual("/opt/tool/tool|--quiet|HOME=/home/person,EMPTY=", posix.calls.map(([file, launchArguments, environment]) => [file, launchArguments.join(","), environment.join(",")].join("|")).join());
      Assert.isTrue((posix.calls[0]?.[3] ?? 0) > 2, String(posix.calls[0]?.[3]));
      Assert.isUndefined(posix.calls[0]?.[4]);
    });
  }

  @TestMethod
  public givesThePosixAddonTheWorkingFolder(): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const posix = new PosixProcessApiFixture(4_321);

      await new ChildProcessStarter("linux", posix).startAsync("/opt/tool/tool", [], {}, errorFile, "/home/person");

      Assert.areEqual("/home/person", posix.calls[0]?.[4]);
    });
  }

  @TestMethod
  public asksTheAddonToDisclaimResponsibilityOnMacOSAlone(): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const posix = new PosixProcessApiFixture(4_321);

      await new ChildProcessStarter("darwin", posix).startAsync("/opt/tool/tool", [], {}, errorFile);
      await new ChildProcessStarter("linux", posix).startAsync("/opt/tool/tool", [], {}, errorFile);
      await new ChildProcessStarter("darwin", posix, true, null).startAsync("/opt/tool/tool", [], {}, errorFile);

      Assert.areEqual(JSON.stringify(["responsibility_spawnattrs_setdisclaim", null, null]), JSON.stringify(posix.calls.map(t => t[7] ?? null)));
    });
  }

  @TestMethod
  public reportsWhatThePosixAddonCouldNotStart(): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const failure = new Error("execve failed: No such file or directory");

      const exception = await Assert.throwsAsync(() => new ChildProcessStarter("darwin", new PosixProcessApiFixture(failure)).startAsync("/opt/tool/tool", [], {}, errorFile), LaunchStartFailedException);

      Assert.areEqual("The program /opt/tool/tool could not be started.", exception.message);
      Assert.areEqual<unknown>(failure, exception.cause);
    });
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public closesTheDescriptorsItsCallerLeftOpenOnPosix(): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const folder = path.dirname(errorFile);
      const holder = path.join(folder, "holder.mjs");
      const marker = path.join(folder, "marker");
      const result = path.join(folder, "result");
      await writeFile(holder, ChildProcessStarterTests.HOLDER);
      const held = await open(marker, "w");
      let output = String.empty;
      try {
        const child = spawn(process.execPath, [holder, import.meta.resolve("@noldova/desktop.runtime"), ChildProcessStarterTests.PROBE, marker, result, errorFile], {
          stdio: [...Array.from({ length: ChildProcessStarterTests.DESCRIPTOR_NODE_LEAVES_INHERITABLE }, (_, t): "pipe" | "ignore" => t === 2 ? "pipe" : "ignore"), held.fd]
        });
        child.stderr?.on("data", (chunk: Buffer) => output += chunk.toString());
        const [code]: unknown[] = await once(child, "exit");
        Assert.areEqual(0, code, output);
      }
      finally {
        await held.close();
      }

      Assert.isTrue(await WaitFixture.untilAsync(() => existsSync(result), ChildProcessStarterTests.HANG_LIMIT), "The program did not report within 20 s.");
      Assert.areEqual("closed", await readFile(result, "utf8"), await readFile(errorFile, "utf8"));
    });
  }

  private static runStartAsync(starter: ChildProcessStarter): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      await writeFile(errorFile, "earlier\n");

      const [program, launchArguments]: [string, string[]] = process.platform === "win32"
        ? [path.join(process.env["SystemRoot"] ?? String.empty, "System32", "cmd.exe"), ["/d", "/c", "1>&2 echo %PROGRAM_MARK%& echo not kept"]]
        : [ChildProcessStarterTests.SHELL, ["-c", "echo \"$PROGRAM_MARK\" >&2; echo not kept"]];

      const processId = await starter.startAsync(program, launchArguments, { ...process.env, PROGRAM_MARK: "started" }, errorFile);

      Assert.isTrue(processId > 0);
      Assert.isTrue(await WaitFixture.untilAsync(() => !ChildProcessStarterTests.isRunning(processId), ChildProcessStarterTests.HANG_LIMIT), "The program did not exit within 20 s.");
      Assert.areEqual("earlier\nstarted\n", (await readFile(errorFile, "utf8")).replaceAll("\r\n", "\n"));
    });
  }

  private static runFolderAsync(starter: ChildProcessStarter): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const folder = path.join(path.dirname(errorFile), "working");
      await mkdir(folder);

      const processId = await starter.startAsync(process.execPath, ["-e", "require('node:fs').writeFileSync('written.txt', 'here')"], process.env, errorFile, folder);

      Assert.isTrue(await WaitFixture.untilAsync(() => !ChildProcessStarterTests.isRunning(processId), ChildProcessStarterTests.HANG_LIMIT), "The program did not exit within 20 s.");
      Assert.areEqual("here", await readFile(path.join(folder, "written.txt"), "utf8"), await readFile(errorFile, "utf8"));
    });
  }

  private static runMissingFolderAsync(starter: ChildProcessStarter): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const exception = await Assert.throwsAsync(
        () => starter.startAsync(process.execPath, ["-e", String.empty], process.env, errorFile, path.join(path.dirname(errorFile), "missing")), LaunchStartFailedException);

      Assert.areEqual(`The program ${process.execPath} could not be started.`, exception.message);
      Assert.isInstanceOf(exception.cause, Error);
    });
  }

  private static runSessionAsync(starter: ChildProcessStarter): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const processId = await starter.startAsync(ChildProcessStarterTests.SHELL, ["-c", "cut -d ' ' -f 6 /proc/self/stat >&2"], process.env, errorFile);

      Assert.isTrue(await WaitFixture.untilAsync(() => !ChildProcessStarterTests.isRunning(processId), ChildProcessStarterTests.HANG_LIMIT), "The program did not exit within 20 s.");
      const session = (await readFile(errorFile, "utf8")).trim();
      Assert.areEqual(String(processId), session);
      Assert.areNotEqual(await ChildProcessStarterTests.readOwnSessionAsync(), session);
    });
  }

  private static runMissingAsync(starter: ChildProcessStarter): Promise<void> {
    return ChildProcessStarterTests.runAsync(async errorFile => {
      const missing = path.join(path.dirname(errorFile), "missing-program");

      const exception = await Assert.throwsAsync(() => starter.startAsync(missing, [], process.env, errorFile), LaunchStartFailedException);

      Assert.areEqual(`The program ${missing} could not be started.`, exception.message);
      Assert.isInstanceOf(exception.cause, Error);
    });
  }

  private static async runAsync(test: (errorFile: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    await test(path.join(folder.path, "start.log"));
  }

  private static async readOwnSessionAsync(): Promise<string> {
    const status = await readFile("/proc/self/stat", "utf8");
    return String(status.slice(status.lastIndexOf(")") + 2).split(" ")[3]);
  }

  private static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }
}
