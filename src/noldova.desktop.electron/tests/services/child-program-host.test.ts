/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { createServer, type Socket } from "node:net";
import { devNull, tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ChildProgramHost, ProgramException } from "@noldova/desktop.electron";
import { type IPosixProcessAddon, type IProcessStarter, LaunchException, LaunchStartFailedException, NativeAddon, PosixResponsibilityApi } from "@noldova/desktop.runtime";

import { Condition } from "../fixtures/condition.fixture.js";
import { ElectronMainFixture } from "../fixtures/electron-main.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { PosixAddonVariantFixture } from "../fixtures/posix-addon-variant.fixture.js";
import { SpawnPatchFixture } from "../fixtures/spawn-patch.fixture.js";
import { WaitFixture } from "../fixtures/wait.fixture.js";

const MISSING = path.join(path.dirname(process.execPath), "noldova-desktop-missing-program");

@TestClass
export class ChildProgramHostTests {
  private static readonly LOOPBACK: string = "127.0.0.1";
  private static readonly ANSWER_WRITER: string = "const socket = require('node:net').connect(Number(process.argv[1]), '127.0.0.1', () => socket.end(process.env.HANDOVER_ANSWER));";
  private static readonly START_WRITER: string = "const socket = require('node:net').connect(Number(process.argv[1]), '127.0.0.1', () => socket.end(`${process.pid}|${require('node:fs').realpathSync.native(process.cwd())}|${process.env.RELAUNCH_ANSWER}`));";
  private static readonly DISCLAIM: string = "responsibility_spawnattrs_setdisclaim";
  private static readonly SANDBOX_HELPER_REFUSED: string = "chrome-sandbox is owned by root and has mode 4755";

  @TestMethod
  public async runsAProgramWithTheGivenEnvironmentAndReturnsItsOutput(): Promise<void> {
    const host = new ChildProgramHost(process.platform, 5000);

    const output = await host.runAsync(process.execPath, ["-e", "process.stdout.write(`${process.argv[1]} ${process.env.TRAY_ANSWER}`)", "(<true>,)"], { ...process.env, TRAY_ANSWER: "answered" });

    Assert.areEqual("(<true>,) answered", output);
  }

  @TestMethod
  public async failsWithTheProgramNamedWhenItFailsIsMissingOrRunsTooLong(): Promise<void> {
    const host = new ChildProgramHost(process.platform, 300);

    const failures = [
      await Assert.throwsAsync(() => host.runAsync(process.execPath, ["-e", "process.exit(3)"], process.env), ProgramException),
      await Assert.throwsAsync(() => host.runAsync(MISSING, [], process.env), ProgramException),
      await Assert.throwsAsync(() => host.runAsync(process.execPath, ["-e", "setTimeout(() => undefined, 10000)"], process.env), ProgramException)
    ];

    Assert.isTrue(failures[0]?.message.startsWith(`${process.execPath} failed: `) === true, failures[0]?.message);
    Assert.isTrue(failures[1]?.message.startsWith(`${MISSING} failed: `) === true, failures[1]?.message);
    Assert.isTrue(failures.every(t => t.cause instanceof Error));
  }

  @TestMethod
  public async passesAStartedProgramsOutputOnAndTellsOnceWhenItEnds(): Promise<void> {
    const host = new ChildProgramHost(process.platform, 5000);
    const output: string[] = [];
    let exits = 0;

    host.start(process.execPath, ["-e", "process.stdout.write(process.env.TRAY_ANSWER ?? '')"], { ...process.env, TRAY_ANSWER: "NameOwnerChanged" }, t => output.push(t), () => exits++);

    await Condition.waitAsync(() => exits > 0);
    Assert.areEqual("NameOwnerChanged", output.join(String.empty));
    Assert.areEqual(1, exits);
  }

  @TestMethod
  public async startsADetachedProgramWithTheGivenEnvironment(): Promise<void> {
    const answer = await ChildProgramHostTests.answerAsync((port, onFailure) =>
      new ChildProgramHost(process.platform, 5000).startDetached(process.execPath, ["-e", ChildProgramHostTests.ANSWER_WRITER, port], { ...process.env, HANDOVER_ANSWER: "handed over" }, onFailure));

    Assert.areEqual("handed over", answer);
  }

  @TestMethod
  public async startsADetachedProgramInTheGivenFolderAndAnswersOnceItHasStarted(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "cr-"));
    try {
      const started = await ChildProgramHostTests.answerAsync(port =>
        new ChildProgramHost(process.platform, 5000).startDetachedAsync(process.execPath, ["-e", ChildProgramHostTests.START_WRITER, port], { ...process.env, RELAUNCH_ANSWER: "relaunched" }, folder));

      const [processId, ...answer] = started.split("|");
      await Condition.waitAsync(() => !ChildProgramHostTests.isRunning(Number(processId)));
      Assert.areEqual(`${realpathSync.native(folder)}|relaunched`, answer.join("|"));
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public async startsADetachedProgramThroughTheStarterWithItsOutputDiscarded(): Promise<void> {
    const calls: [string, readonly string[], NodeJS.ProcessEnv, string, string | undefined][] = [];
    const starter: IProcessStarter = {
      startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string, workingFolder?: string): Promise<number> {
        calls.push([executable, launchArguments, environment, errorFile, workingFolder]);
        return Promise.resolve(4321);
      }
    };
    const host = new ChildProgramHost("linux", 5000, starter);
    const environment = { PATH: "/usr/bin" };

    host.startDetached("/opt/noldova-desktop/noldova-desktop", ["--data-dir=/home/person/work-data"], environment, () => undefined);
    await host.startDetachedAsync("/opt/noldova-desktop/noldova-desktop", [], environment, "/home/person");

    Assert.areEqual(JSON.stringify([
      ["/opt/noldova-desktop/noldova-desktop", ["--data-dir=/home/person/work-data"], environment, devNull, null],
      ["/opt/noldova-desktop/noldova-desktop", [], environment, devNull, "/home/person"]
    ]), JSON.stringify(calls));
  }

  @TestMethod
  public async startsADetachedProgramOnWindowsWithoutHidingItsWindows(): Promise<void> {
    const host = new ChildProgramHost("win32", 5000);
    const failures: Error[] = [];
    using spawning = new SpawnPatchFixture();
    host.startDetached(process.execPath, [], process.env, t => failures.push(t));
    await host.startDetachedAsync(process.execPath, [], process.env, tmpdir());
    await Condition.waitAsync(() => spawning.options.length === 2);

    Assert.areEqual(JSON.stringify([[true, false], [true, false]]), JSON.stringify(spawning.options.map(t => [t.detached, t.windowsHide])));
    Assert.areEqual(0, failures.length);
  }

  @TestMethod
  public async rejectsADetachedProgramThatCannotStart(): Promise<void> {
    const failure = await Assert.throwsAsync(() => new ChildProgramHost(process.platform, 5000).startDetachedAsync(MISSING, [], process.env, tmpdir()), LaunchStartFailedException);

    Assert.areEqual(`The program ${MISSING} could not be started.`, failure.message);
    Assert.isInstanceOf(failure.cause, Error);
  }

  @TestMethod
  public async reportsADetachedProgramThatCannotStart(): Promise<void> {
    const failures: Error[] = [];

    new ChildProgramHost(process.platform, 5000).startDetached(MISSING, [], process.env, t => failures.push(t));

    await Condition.waitAsync(() => failures.length > 0);
    Assert.isInstanceOf(failures[0], LaunchException);
    Assert.areEqual(`The program ${MISSING} could not be started.`, failures[0]?.message);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async startsADetachedProgramOnLinuxWithoutTheDescriptorsTheMainProcessHolds(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "cf-"));
    const file = path.join(folder, "descriptors");
    try {
      new ChildProgramHost("linux", 5000).startDetached("/bin/sh", ["-c", "ls /proc/self/fd > \"$0.part\" && mv \"$0.part\" \"$0\"", file], process.env, () => undefined);

      await Condition.waitAsync(() => existsSync(file));
      Assert.areEqual("0,1,2,3", readFileSync(file, "utf8").trim().split(/\s+/).map(Number).sort((u, v) => u - v).join(","), "only the standard descriptors and the one ls opens itself remain");
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async refusesAnEmptyPath(): Promise<void> {
    const host = new ChildProgramHost(process.platform, 5000);

    Assert.areEqual("executablePath", (await Assert.throwsAsync(() => host.runAsync(" ", [], process.env), ArgumentException)).parameterName);
    Assert.areEqual("executablePath", Assert.throws(() => host.start(" ", [], process.env, () => undefined, () => undefined), ArgumentException).parameterName);
    Assert.areEqual("executablePath", Assert.throws(() => host.startDetached(" ", [], process.env, () => undefined), ArgumentException).parameterName);
    Assert.areEqual("executablePath", (await Assert.throwsAsync(() => host.startDetachedAsync(" ", [], process.env, tmpdir()), ArgumentException)).parameterName);
  }

  @TestMethod
  public async stopsAStartedProgramAndTellsOnceWhenOneIsMissing(): Promise<void> {
    const host = new ChildProgramHost(process.platform, 5000);
    let exits = 0;
    let missingExits = 0;
    new ChildProgramHost(process.platform, 5000).start(MISSING, [], process.env, () => undefined, () => missingExits++);
    const running = host.start(process.execPath, ["-e", "setTimeout(() => undefined, 10000)"], process.env, () => undefined, () => exits++);

    running.stop();

    await Condition.waitAsync(() => exits > 0);
    Assert.areEqual(1, exits);
    Assert.areEqual(1, missingExits);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  @TestData(PosixAddonVariantFixture.BUILT)
  @TestData(PosixAddonVariantFixture.NO_SYS_NUMBER)
  @TestData(PosixAddonVariantFixture.NO_NUMBERS)
  @TestData(PosixAddonVariantFixture.ENOSYS)
  public startsADetachedProgramFromAnElectronMainProcessOnLinuxWithoutTheDescriptorsChromiumOwns(build: string): Promise<void> {
    return ChildProgramHostTests.startInElectronAsync(build, ["--no-sandbox"]);
  }

  @PlatformFixture.linuxOnly()
  @TestMethod
  public async startsADetachedProgramFromAnElectronMainProcessWithChromiumsSandboxOrOnlyThroughItsFallbackOnLinux(): Promise<void> {
    if (spawnSync("unshare", ["-Ur", "true"]).status === 0) {
      await ChildProgramHostTests.startInElectronAsync(PosixAddonVariantFixture.BUILT, []);
      return;
    }
    const folder = await mkdtemp(path.join(tmpdir(), "cp-"));
    try {
      const addon = await PosixAddonVariantFixture.buildAsync(PosixAddonVariantFixture.BUILT, folder);
      const mainProcess = ElectronMainFixture.start("posix-start-main.fixture.js", ["--ozone-platform=headless", addon, path.join(folder, "descriptors")]);
      try {
        Assert.areNotEqual(0, await mainProcess.exited, mainProcess.text.errors);
        Assert.isTrue(mainProcess.text.errors.includes(ChildProgramHostTests.SANDBOX_HELPER_REFUSED), mainProcess.text.errors);
      }
      finally {
        mainProcess.process.kill();
      }
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
    await ChildProgramHostTests.startInElectronAsync(PosixAddonVariantFixture.BUILT, ["--no-sandbox"]);
  }

  @PlatformFixture.macOnly()
  @TestMethod
  public async startsAProgramPlainlyWhenTheDisclaimedSpawnFailsAndAsItsOwnResponsibleProcessWhenItDoesNotOnMacOS(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-spawn-failure-"));
    const started: number[] = [];
    try {
      const addon = new NativeAddon<IPosixProcessAddon>(await PosixAddonVariantFixture.buildAsync(PosixAddonVariantFixture.SPAWN_FAILURE_HOOK, folder), ["startDetached"]);
      const responsibility = PosixResponsibilityApi.create("darwin");
      if (Object.isNull(responsibility))
        Assert.fail("There is no responsibility API on macOS.");
      const errors = await open(path.join(folder, "start.log"), "w");
      try {
        const start = (input: string): number => {
          const processId = addon.expect(addon.load().startDetached?.("/bin/sleep", ["30"], [], errors.fd, undefined, undefined, undefined, ChildProgramHostTests.DISCLAIM, input),
            (t): t is number => Object.isNumber(t) && t > 0);
          started.push(processId);
          return processId;
        };

        const plain = start(path.join(folder, "missing-input"));
        const disclaimed = start(devNull);
        const own = responsibility.findResponsible(process.pid);

        Assert.isNotNull(own);
        Assert.areEqual(JSON.stringify([own, disclaimed]), JSON.stringify([responsibility.findResponsible(plain), responsibility.findResponsible(disclaimed)]));
        Assert.areNotEqual(plain, own);
      }
      finally {
        await errors.close();
      }
    }
    finally {
      started.forEach(t => ChildProgramHostTests.end(t));
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async startInElectronAsync(build: string, switches: readonly string[]): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "cp-"));
    const file = path.join(folder, "descriptors");
    const environment = { ...process.env };
    delete environment["DISPLAY"];
    delete environment["WAYLAND_DISPLAY"];
    try {
      const addon = await PosixAddonVariantFixture.buildAsync(build, folder);
      Assert.isTrue((await PosixAddonVariantFixture.readImportsAsync(addon)).includes("syscall"), "the addon calls close_range through syscall");
      const mainProcess = ElectronMainFixture.start("posix-start-main.fixture.js", [...switches, "--ozone-platform=headless", addon, file], environment);
      try {
        Assert.areEqual(0, await mainProcess.exited, mainProcess.text.errors);
        await WaitFixture.untilAsync(() => existsSync(file), "the program to list its descriptors", 10_000, 5);

        Assert.areEqual("0,1,2,3", readFileSync(file, "utf8").trim().split(/\s+/).map(Number).sort((u, v) => u - v).join(","), "only the standard descriptors and the one ls opens itself remain");
      }
      finally {
        mainProcess.process.kill();
      }
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async answerAsync(start: (port: string, onFailure: (error: Error) => void) => void | Promise<void>): Promise<string> {
    const server = createServer();
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, ChildProgramHostTests.LOOPBACK, resolve);
      });
      const bound = server.address();
      if (Object.isNull(bound) || Object.isString(bound))
        Assert.fail("The answer server is not listening on a TCP port.");
      const port = String(bound.port);
      return await new Promise<string>((resolve, reject) => {
        server.once("connection", (socket: Socket) => {
          const parts: string[] = [];
          socket.setEncoding("utf8");
          socket.on("data", (t: string) => parts.push(t));
          socket.once("end", () => resolve(parts.join(String.empty)));
          socket.once("error", reject);
        });
        Promise.resolve(start(port, reject)).catch(reject);
      });
    }
    finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }

  private static end(processId: number): boolean {
    try {
      return process.kill(processId, "SIGKILL");
    }
    catch {
      return false;
    }
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
