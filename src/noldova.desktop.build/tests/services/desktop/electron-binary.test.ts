/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { Resources } from "../../../src/resources.js";
import { ElectronBinary } from "../../../src/services/desktop/electron-binary.js";
import { DevelopmentFolderFixture } from "../../fixtures/development-folder.fixture.js";
import { PausedTimersFixture } from "../../fixtures/paused-timers.fixture.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";

@TestClass
export class ElectronBinaryTests {
  private static readonly PAUSE: number = 15_000;
  private static readonly INSTALLING: string = "Installing Electron's binary...\n";

  @TestMethod
  public async installsNothingWithoutElectronsInstallerOrWhenItsBinaryIsThereAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    const runner = new ScriptedRunnerFixture();
    const binary = new ElectronBinary(folder.path, runner);
    const output = new PassThrough();

    await binary.installAsync(output);
    await folder.writeAsync(["node_modules", "electron", "install.js"], String.empty);
    await ElectronBinaryTests.installElectronAsync(folder);
    await binary.installAsync(output);

    Assert.isTrue(binary.isInstalled());
    Assert.isNull(output.read(output.readableLength));
    Assert.areEqual(0, runner.captured.length);
  }

  @TestMethod
  public async callsAPathWithoutItsBinaryNotInstalledAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeAsync(["node_modules", "electron", "path.txt"], "electron");

    Assert.isFalse(new ElectronBinary(folder.path, new ScriptedRunnerFixture()).isInstalled());
  }

  @TestMethod
  public async runsTheInstallerUntilTheBinaryIsThereAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    const installer = await folder.writeAsync(["node_modules", "electron", "install.js"], String.empty);
    const answers = [new ProcessResult(1, String.empty, "TypeError: fetch failed\n"), new ProcessResult(1, String.empty, "Error: Response code 503 (Service Unavailable)\n")];
    const runner = new ScriptedRunnerFixture(async () => {
      const answer = answers.shift();
      if (!Object.isUndefined(answer))
        return answer;
      await ElectronBinaryTests.installElectronAsync(folder);
      return ScriptedRunnerFixture.SUCCESS;
    });
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));

    await PausedTimersFixture.withoutPausesAsync(() => new ElectronBinary(folder.path, runner, "arm64", { SAMPLE_SETTING: "kept" }).installAsync(output), ElectronBinaryTests.PAUSE);

    Assert.areEqual([
      ElectronBinaryTests.INSTALLING,
      "Electron's binary could not be installed (attempt 1 of 4); trying again in 15 seconds.\n",
      "Electron's binary could not be installed (attempt 2 of 4); trying again in 15 seconds.\n"
    ].join(String.empty), chunks.join(String.empty));
    Assert.areEqual(`${path.basename(process.execPath)} ${installer}`, [...new Set(runner.captured)].join("|"));
    Assert.areEqual(3, runner.captured.length);
    Assert.areEqual("arm64|kept", [runner.environments[0]?.["npm_config_arch"], runner.environments[0]?.["SAMPLE_SETTING"]].join("|"));
  }

  @TestMethod
  public async givesUpWithTheLastFailureAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeAsync(["node_modules", "electron", "install.js"], String.empty);
    const runner = new ScriptedRunnerFixture(() => new ProcessResult(1, String.empty, "TypeError: fetch failed\n"));

    const error = await Assert.throwsAsync(
      () => PausedTimersFixture.withoutPausesAsync(() => new ElectronBinary(folder.path, runner).installAsync(new PassThrough()), ElectronBinaryTests.PAUSE), BuildException);

    Assert.areEqual("Electron's binary could not be installed in 4 attempts; the last failed with exit code 1: TypeError: fetch failed.", error.message);
    Assert.areEqual(4, runner.captured.length);
  }

  @TestMethod
  public async failsAtOnceWhenTheInstallerFailsOtherThanOnTheNetworkAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeAsync(["node_modules", "electron", "install.js"], String.empty);
    const failure = "Error: Response code 404 (Not Found) for https://example.com/electron.zip";
    const runner = new ScriptedRunnerFixture(() => new ProcessResult(1, String.empty, `${failure}\n`));

    const error = await Assert.throwsAsync(
      () => PausedTimersFixture.withoutPausesAsync(() => new ElectronBinary(folder.path, runner).installAsync(new PassThrough()), ElectronBinaryTests.PAUSE), BuildException);

    Assert.areEqual(Resources.formatDownloadNotRetried(Resources.electronSubject, Resources.formatExitCodeProblem(1, failure)), error.message);
    Assert.areEqual(1, runner.captured.length);
  }

  @TestMethod
  public async failsAtOnceWhenTheInstallerSucceedsButLeavesNoBinaryAsync(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeAsync(["node_modules", "electron", "install.js"], String.empty);
    const runner = new ScriptedRunnerFixture(() => new ProcessResult(0, String.empty, String.empty));

    const error = await Assert.throwsAsync(
      () => PausedTimersFixture.withoutPausesAsync(() => new ElectronBinary(folder.path, runner).installAsync(new PassThrough()), ElectronBinaryTests.PAUSE), BuildException);

    Assert.areEqual(Resources.formatDownloadNotRetried(Resources.electronSubject, Resources.electronStillMissing), error.message);
    Assert.areEqual(1, runner.captured.length);
  }

  private static async installElectronAsync(folder: DevelopmentFolderFixture): Promise<void> {
    await folder.writeAsync(["node_modules", "electron", "path.txt"], "electron");
    await folder.writeAsync(["node_modules", "electron", "dist", "electron"], "electron");
  }
}
