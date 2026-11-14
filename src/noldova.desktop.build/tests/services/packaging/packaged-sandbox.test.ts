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

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackagedSandbox } from "../../../src/services/packaging/packaged-sandbox.js";

interface IFakeProcess {
  readonly id: number;
  readonly parent: number;
  readonly seccomp: number;
  readonly arguments: readonly string[];
}

@TestClass
export class PackagedSandboxTests {
  private static readonly STARTED: number = 100;
  private static readonly APP: readonly IFakeProcess[] = [
    { id: 100, parent: 1, seccomp: 0, arguments: ["/home/person/App.AppImage", "--data-dir=/tmp/data"] },
    { id: 101, parent: 100, seccomp: 0, arguments: ["/tmp/.mount_App/app", "--data-dir=/tmp/data"] },
    { id: 102, parent: 101, seccomp: 0, arguments: ["/tmp/.mount_App/app", "--type=zygote"] },
    { id: 104, parent: 101, seccomp: 0, arguments: ["/tmp/.mount_App/app", "--type=gpu-process"] },
    { id: 103, parent: 102, seccomp: 2, arguments: ["/tmp/.mount_App/app", "--type=renderer"] },
    { id: 105, parent: 102, seccomp: 2, arguments: ["/tmp/.mount_App/app", "--type=renderer"] },
    { id: 200, parent: 1, seccomp: 0, arguments: ["/usr/bin/other", "--type=renderer", "--no-sandbox"] }
  ];

  @TestMethod
  public async reportsTheSandboxOnWhenTheMainProcessKeepsItAndEveryRendererIsFilteredAsync(): Promise<void> {
    const report = await PackagedSandboxTests.verifyAsync(PackagedSandboxTests.APP, true);

    Assert.areEqual(
      "Chromium's sandbox is on: the main process runs without --no-sandbox, and every renderer runs under a seccomp filter, mode 2 "
        + "(zygote 0, renderer 2, gpu-process 0, renderer 2).",
      report);
  }

  @TestMethod
  public async reportsTheSandboxOffWhenTheMainProcessRunsWithNoSandboxAsync(): Promise<void> {
    const report = await PackagedSandboxTests.verifyAsync(PackagedSandboxTests.unsandboxed(), false);

    Assert.areEqual("Chromium's sandbox is off: the main process runs with --no-sandbox (zygote 0, renderer 0, gpu-process 0, renderer 0).", report);
  }

  @TestMethod
  public async refusesASandboxThatIsOffOrLeavesARendererUnfilteredWhenItMustBeOnAsync(): Promise<void> {
    const unfiltered = PackagedSandboxTests.APP.map(t => t.id === 105 ? { ...t, seccomp: 0 } : t);

    const off = await Assert.throwsAsync(() => PackagedSandboxTests.verifyAsync(PackagedSandboxTests.unsandboxed(), true), BuildException);
    const partly = await Assert.throwsAsync(() => PackagedSandboxTests.verifyAsync(unfiltered, true), BuildException);

    Assert.areEqual(
      "Chromium's sandbox must be on, but the main process 101 runs with --no-sandbox, and its processes' seccomp modes are: zygote 0, renderer 0, gpu-process 0, renderer 0.",
      off.message);
    Assert.areEqual(
      "Chromium's sandbox must be on, but the main process 101 runs without --no-sandbox, and its processes' seccomp modes are: zygote 0, renderer 2, gpu-process 0, renderer 0.",
      partly.message);
  }

  @TestMethod
  public async refusesASandboxThatIsOnWhenItMustBeOffAsync(): Promise<void> {
    const error = await Assert.throwsAsync(() => PackagedSandboxTests.verifyAsync(PackagedSandboxTests.APP, false), BuildException);

    Assert.areEqual(
      "Chromium's sandbox must be off here, but the main process 101 runs without --no-sandbox, and its processes' seccomp modes are: zygote 0, renderer 2, gpu-process 0, renderer 2.",
      error.message);
  }

  @TestMethod
  public async refusesToCheckWithoutOneMainProcessOrARendererAsync(): Promise<void> {
    const alone = PackagedSandboxTests.APP.filter(t => t.id <= 101);
    const twice = [...PackagedSandboxTests.APP, { id: 106, parent: 100, seccomp: 0, arguments: ["/tmp/.mount_App/app"] }, { id: 107, parent: 106, seccomp: 0, arguments: ["/tmp/.mount_App/app", "--type=gpu-process"] }];
    const blank = PackagedSandboxTests.APP.filter(t => t.id !== 103 && t.id !== 105);

    const errors = [
      await Assert.throwsAsync(() => PackagedSandboxTests.verifyAsync(alone, true), BuildException),
      await Assert.throwsAsync(() => PackagedSandboxTests.verifyAsync(twice, true), BuildException),
      await Assert.throwsAsync(() => PackagedSandboxTests.verifyAsync(blank, true), BuildException)
    ];

    Assert.areEqual(JSON.stringify([
      "The started process 100 has 0 Electron main processes among its descendants instead of one, so its sandbox cannot be checked; they are 100 untyped, 101 untyped.",
      "The started process 100 has 2 Electron main processes among its descendants instead of one, so its sandbox cannot be checked; "
        + "they are 100 untyped, 101 untyped, 102 zygote, 103 renderer, 104 gpu-process, 105 renderer, 106 untyped, 107 gpu-process.",
      "The main process 101 has no renderer, so its sandbox cannot be checked."
    ]), JSON.stringify(errors.map(t => t.message)));
  }

  @TestMethod
  public async skipsAProcessThatEndedWhileItWasReadAsync(): Promise<void> {
    const report = await PackagedSandboxTests.verifyAsync(PackagedSandboxTests.APP, true, async folder => {
      await mkdir(path.join(folder, "150"));
      await mkdir(path.join(folder, "self"));
    });

    Assert.isTrue(report.startsWith("Chromium's sandbox is on"), report);
  }

  @TestMethod
  public async waitsForARendererThatStartsItsFilterAfterTheFirstReadAsync(): Promise<void> {
    const starting = PackagedSandboxTests.APP.map(t => t.id === 105 ? { ...t, seccomp: 0 } : t);
    const pauses: number[] = [];

    const report = await PackagedSandboxTests.verifyAsync(starting, true, undefined, async (milliseconds, folder) => {
      pauses.push(milliseconds);
      await PackagedSandboxTests.writeAsync(folder, { id: 105, parent: 102, seccomp: 2, arguments: ["/tmp/.mount_App/app", "--type=renderer"] });
    });

    Assert.areEqual("Chromium's sandbox is on: the main process runs without --no-sandbox, and every renderer runs under a seccomp filter, mode 2 "
      + "(zygote 0, renderer 2, gpu-process 0, renderer 2).", report);
    Assert.areEqual("250", pauses.join(","));
  }

  @TestMethod
  public async stopsWaitingForARendererFilterAtTheDeadlineAndWaitsOnlyWhenTheSandboxMustBeOnAsync(): Promise<void> {
    const unfiltered = PackagedSandboxTests.APP.map(t => t.id === 105 ? { ...t, seccomp: 0 } : t);
    const sandboxed: number[] = [];
    const unsandboxed: number[] = [];

    const error = await Assert.throwsAsync(() => PackagedSandboxTests.verifyAsync(unfiltered, true, undefined, t => {
      sandboxed.push(t);
      return Promise.resolve();
    }), BuildException);
    await PackagedSandboxTests.verifyAsync(PackagedSandboxTests.unsandboxed(), false, undefined, t => {
      unsandboxed.push(t);
      return Promise.resolve();
    });

    Assert.isTrue(error.message.endsWith("zygote 0, renderer 2, gpu-process 0, renderer 0."), error.message);
    Assert.areEqual(20, sandboxed.length);
    Assert.areEqual(5000, sandboxed.reduce((total, t) => total + t, 0));
    Assert.areEqual(0, unsandboxed.length);
  }

  @TestMethod
  public async throwsAReadFailureOtherThanAnEndedOrForeignProcessAsync(): Promise<void> {
    let error: unknown = null;

    try {
      await PackagedSandboxTests.verifyAsync(PackagedSandboxTests.APP, true, async folder => {
        await mkdir(path.join(folder, "150", "status"), { recursive: true });
      });
    }
    catch (thrown) {
      error = thrown;
    }

    Assert.isTrue(error instanceof Error && "code" in error && error.code === "EISDIR", String(error));
  }

  private static unsandboxed(): readonly IFakeProcess[] {
    return PackagedSandboxTests.APP.map(t => {
      if (t.id === 100 || t.id === 101)
        return { ...t, arguments: [...t.arguments, "--no-sandbox"] };
      return { ...t, seccomp: 0 };
    });
  }

  private static async verifyAsync(
    processes: readonly IFakeProcess[],
    isSandboxed: boolean,
    prepareAsync?: (folder: string) => Promise<void>,
    pauseAsync?: (milliseconds: number, folder: string) => Promise<void>): Promise<string> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-packaged-sandbox-"));
    let now = 1_000_000;
    try {
      for (const fake of processes)
        await PackagedSandboxTests.writeAsync(folder, fake);
      await prepareAsync?.(folder);
      return await new PackagedSandbox(folder, {
        now: () => now,
        pauseAsync: async milliseconds => {
          now += milliseconds;
          await pauseAsync?.(milliseconds, folder);
        }
      }).verifyAsync(PackagedSandboxTests.STARTED, isSandboxed);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static async writeAsync(folder: string, fake: IFakeProcess): Promise<void> {
    const processFolder = path.join(folder, String(fake.id));
    await mkdir(processFolder, { recursive: true });
    await writeFile(path.join(processFolder, "status"), `Name:\tapp\nPid:\t${fake.id}\nPPid:\t${fake.parent}\nSeccomp:\t${fake.seccomp}\nSeccomp_filters:\t${fake.seccomp === 2 ? 1 : 0}\n`);
    const retitled = fake.arguments.some(t => t.startsWith("--type="));
    await writeFile(path.join(processFolder, "cmdline"), retitled ? fake.arguments.join(" ") : `${fake.arguments.join("\0")}\0`);
  }
}
