/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Writable } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import type { IKilledCopySession } from "../../../src/interfaces/i-killed-copy-session.js";
import type { ISmokeCopy } from "../../../src/interfaces/i-smoke-copy.js";
import { InstalledPackage } from "../../../src/models/packaging/installed-package.js";
import { Resources } from "../../../src/resources.js";
import { MountedAppImage } from "../../../src/services/packaging/mounted-app-image.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { SmokeProcessFixture } from "../../fixtures/smoke-process.fixture.js";

class RecordedOutput extends Writable {
  public text: string = String.empty;

  public override _write(chunk: unknown, _encoding: BufferEncoding, done: (error?: Error | null) => void): void {
    this.text += String(chunk);
    done();
  }
}

class RuntimeRunner extends ProcessRunner {
  public readonly killed: number[] = [];
  public isUp: boolean = true;

  public override isRunning(): boolean {
    return this.isUp;
  }

  public override kill(processId: number): void {
    this.killed.push(processId);
  }
}

class StubbornProcess extends SmokeProcessFixture {
  public override signal(name: NodeJS.Signals): void {
    this.signals.push(name);
  }
}

class RecordedCopy implements ISmokeCopy {
  public readonly items: readonly string[] = ["copy"];
  private readonly calls: string[];

  public constructor(calls: string[]) {
    this.calls = calls;
  }

  public isPresentAsync(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public requireOutlivesAsync(runtime: number, moment: string): Promise<void> {
    this.calls.push(`outlives ${runtime} ${moment}`);
    return Promise.resolve();
  }

  public checkKilledAsync(): Promise<void> {
    return Promise.resolve();
  }
}

@TestClass
export class MountedAppImageTests {
  private static readonly RUNTIME: number = 4242;
  private static readonly MAIN: number = 4141;
  private static readonly DATA: string = "/tmp/smoke/data";
  private static readonly FOLDER: string = "/tmp/smoke";

  @TestMethod
  public async findsTheLongestFuseMountThatHoldsTheRuntimesProgramThroughAPipe(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync();
    const output = new RecordedOutput();

    const copy = await MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, new RuntimeRunner(), () => Promise.resolve(null), output);

    Assert.areEqual(fixture.mount, copy.items.join("|"));
    Assert.areEqual(Resources.formatSmokeMounted(fixture.mount), output.text);
  }

  @TestMethod
  public async refusesARuntimeWhoseInputIsNotAPipe(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync("/dev/null");
    const output = new RecordedOutput();

    const error = await Assert.throwsAsync(() => MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, new RuntimeRunner(), () => Promise.resolve(null), output),
      BuildException);

    Assert.areEqual(Resources.formatSmokeNoMount(MountedAppImageTests.RUNTIME, fixture.program, "/dev/null"), error.message);
    Assert.areEqual(String.empty, output.text);
  }

  @TestMethod
  public async refusesARuntimeWithoutAFuseMountAroundItsProgram(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync();
    await fixture.writeMountsAsync(["22 1 8:1 / / rw,relatime shared:1 - ext4 /dev/sda1 rw", "36 25 0:32 / /tmp/.mount_other rw,nosuid,nodev shared:2 - fuse.other other ro"]);
    const output = new RecordedOutput();

    const error = await Assert.throwsAsync(() => MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, new RuntimeRunner(), () => Promise.resolve(null), output),
      BuildException);

    Assert.areEqual(Resources.formatSmokeNoMount(MountedAppImageTests.RUNTIME, fixture.program, "pipe:[1]"), error.message);
    Assert.areEqual(String.empty, output.text);
  }

  @TestMethod
  public async isPresentWhileTheMountTableListsItsMount(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync();
    const copy = await MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, new RuntimeRunner(), () => Promise.resolve(null), new RecordedOutput());

    const before = await copy.isPresentAsync();
    await fixture.writeMountsAsync(["22 1 8:1 / / rw,relatime shared:1 - ext4 /dev/sda1 rw"]);
    const after = await copy.isPresentAsync();

    Assert.isTrue(before);
    Assert.isFalse(after);
  }

  @TestMethod
  public async isNotPresentWhenTheMountTableCutsItsFuseLineShort(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync();
    const copy = await MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, new RuntimeRunner(), () => Promise.resolve(null), new RecordedOutput());

    await fixture.writeMountsAsync(["36 - fuse.sample-app"]);

    Assert.isFalse(await copy.isPresentAsync());
  }

  @TestMethod
  public async saysTheMountOutlivedTheMainProcessOrRefusesOneThatEndedWhileTheRuntimeRan(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync();
    const output = new RecordedOutput();
    const copy = await MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, new RuntimeRunner(), () => Promise.resolve(MountedAppImageTests.RUNTIME), output);

    await copy.requireOutlivesAsync(MountedAppImageTests.RUNTIME, Resources.smokeMomentQuit);
    await fixture.writeMountsAsync([]);
    const error = await Assert.throwsAsync(() => copy.requireOutlivesAsync(MountedAppImageTests.RUNTIME, Resources.smokeMomentKilled), BuildException);

    Assert.areEqual(`${Resources.formatSmokeMounted(fixture.mount)}${Resources.formatMountOutlived(Resources.smokeMomentQuit)}`, output.text);
    Assert.areEqual(Resources.formatMountEndedEarly(fixture.mount, Resources.smokeMomentKilled, MountedAppImageTests.RUNTIME), error.message);
  }

  @TestMethod
  public async killsTheMainProcessThenTheRuntimeAndWaitsForTheCopyToEnd(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync();
    const runner = new RuntimeRunner();
    const copy = await MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, runner, () => Promise.resolve(null), new RecordedOutput());
    const main = new SmokeProcessFixture(MountedAppImageTests.MAIN, null, () => undefined);
    const calls: string[] = [];

    await copy.checkKilledAsync(MountedAppImageTests.createSession(calls, main, MountedAppImageTests.RUNTIME, true));

    const log = path.join(MountedAppImageTests.FOLDER, Resources.smokeKilledMainLogFile);
    Assert.areEqual([
      `start ${log}`,
      `wait ${log}|${path.join(MountedAppImageTests.DATA, ...Resources.smokeDataLogSegments)}`,
      `read ${MountedAppImageTests.DATA}`,
      `track ${MountedAppImageTests.RUNTIME}`,
      `copy ${MountedAppImageTests.RUNTIME}`,
      `outlives ${MountedAppImageTests.RUNTIME} ${Resources.smokeMomentKilled}`,
      `exit ${MountedAppImageTests.RUNTIME} ${Resources.smokeKillLimit}`,
      "track null",
      `ended ${Resources.smokeMomentKilled} ${path.join(MountedAppImageTests.DATA, ...Resources.smokeRuntimeLogSegments)}`
    ].join("\n"), calls.join("\n"));
    Assert.areEqual(String(MountedAppImageTests.RUNTIME), runner.killed.join("|"));
    Assert.areEqual(Resources.killSignal, main.signals.join("|"));
  }

  @TestMethod
  public async refusesADiscoveryFileThatNamesNoRuntimeAndEndsTheMainProcess(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync();
    const runner = new RuntimeRunner();
    const copy = await MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, runner, () => Promise.resolve(null), new RecordedOutput());
    const main = new SmokeProcessFixture(MountedAppImageTests.MAIN, null, () => undefined);
    const calls: string[] = [];

    const error = await Assert.throwsAsync(() => copy.checkKilledAsync(MountedAppImageTests.createSession(calls, main, null, true)), BuildException);

    Assert.areEqual(Resources.formatSmokeDiscoveryNamesNoProcess(path.join(MountedAppImageTests.DATA, ...Resources.runtimeDiscoverySegments)), error.message);
    Assert.isFalse(calls.some(t => t.startsWith("track") || t.startsWith("copy")), calls.join("\n"));
    Assert.areEqual(0, runner.killed.length);
    Assert.areEqual(Resources.killSignal, main.signals.join("|"));
  }

  @TestMethod
  public async refusesAMainProcessThatOutlivesItsKill(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync();
    const runner = new RuntimeRunner();
    const copy = await MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, runner, () => Promise.resolve(null), new RecordedOutput());
    const main = new StubbornProcess(MountedAppImageTests.MAIN, null, () => undefined);
    const calls: string[] = [];

    const error = await Assert.throwsAsync(() => copy.checkKilledAsync(MountedAppImageTests.createSession(calls, main, MountedAppImageTests.RUNTIME, true)), BuildException);

    Assert.areEqual(Resources.smokeMainStillRunning, error.message);
    Assert.isFalse(calls.some(t => t.startsWith("outlives")), calls.join("\n"));
    Assert.areEqual(0, runner.killed.length);
    Assert.areEqual(`${Resources.killSignal}|${Resources.killSignal}`, main.signals.join("|"));
  }

  @TestMethod
  public async refusesARuntimeThatOutlivesItsKill(): Promise<void> {
    await using fixture = await MountedAppImageTests.createAsync();
    const runner = new RuntimeRunner();
    const copy = await MountedAppImage.findAsync(fixture.processes, fixture.readLinkAsync, MountedAppImageTests.RUNTIME, runner, () => Promise.resolve(null), new RecordedOutput());
    const main = new SmokeProcessFixture(MountedAppImageTests.MAIN, null, () => undefined);
    const calls: string[] = [];

    const error = await Assert.throwsAsync(() => copy.checkKilledAsync(MountedAppImageTests.createSession(calls, main, MountedAppImageTests.RUNTIME, false)), BuildException);

    Assert.areEqual(Resources.formatSmokeRuntimeStillRunning(MountedAppImageTests.RUNTIME), error.message);
    Assert.areEqual(String(MountedAppImageTests.RUNTIME), runner.killed.join("|"));
    Assert.isFalse(calls.some(t => t === "track null" || t.startsWith("ended")), calls.join("\n"));
  }

  private static createSession(calls: string[], main: SmokeProcessFixture, runtime: number | null, exits: boolean): IKilledCopySession {
    return {
      installed: new InstalledPackage("/opt/app/Sample.AppImage", "/opt/app/sample-app", "/opt/app/resources", null),
      data: MountedAppImageTests.DATA,
      folder: MountedAppImageTests.FOLDER,
      startMainProcessAsync: (_installed, _data, _folder, log) => {
        calls.push(`start ${log}`);
        return Promise.resolve(main);
      },
      waitForRuntimeAsync: (_installed, _data, _folder, _mainProcess, logs) => {
        calls.push(`wait ${logs.join("|")}`);
        return Promise.resolve(String.empty);
      },
      readRuntimeIdAsync: data => {
        calls.push(`read ${data}`);
        return Promise.resolve(runtime);
      },
      requireCopyAsync: (_data, found) => {
        calls.push(`copy ${found}`);
        return Promise.resolve(new RecordedCopy(calls));
      },
      waitForExitAsync: (found, limit) => {
        calls.push(`exit ${found} ${limit}`);
        return Promise.resolve(exits);
      },
      requireCopyEndedAsync: (_copy, moment, log) => {
        calls.push(`ended ${moment} ${log}`);
        return Promise.resolve();
      },
      track: found => {
        calls.push(`track ${found}`);
      }
    };
  }

  private static async createAsync(input: string = "pipe:[1]"):
    Promise<{ readonly processes: string; readonly mount: string; readonly program: string; readLinkAsync(link: string): Promise<string>; writeMountsAsync(lines: readonly string[]): Promise<void> } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-mounted-app-image-"));
    const processes = path.join(folder, "proc");
    const outer = "/tmp/desktop-mounted-app-image/mnt";
    const mount = `${outer}/.mount_sample`;
    const program = `${mount}/sample-app`;
    const runtime = path.join(processes, String(MountedAppImageTests.RUNTIME));
    await mkdir(path.join(processes, "self"), { recursive: true });
    const links = new Map([[path.join(runtime, "exe"), program], [path.join(runtime, "fd", "0"), input]]);
    const readLinkAsync = (link: string): Promise<string> => {
      const target = links.get(link);
      return Object.isUndefined(target) ? Promise.reject(new Error(`${link} is no link.`)) : Promise.resolve(target);
    };
    const writeMountsAsync = (lines: readonly string[]): Promise<void> => writeFile(path.join(processes, "self", "mountinfo"), lines.map(t => `${t}\n`).join(String.empty));
    await writeMountsAsync([
      "22 1 8:1 / / rw,relatime shared:1 - ext4 /dev/sda1 rw",
      `35 22 0:31 / ${outer} rw,nosuid,nodev shared:2 - fuse sample ro`,
      `36 35 0:32 / ${mount} rw,nosuid,nodev shared:3 - fuse.sample-app sample-app ro,user_id=1000`
    ]);
    return {
      processes,
      mount,
      program,
      readLinkAsync,
      writeMountsAsync,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(folder, { recursive: true, force: true });
      }
    };
  }
}
