/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { mock } from "node:test";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageReport } from "../../../src/models/packaging/package-report.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { Resources } from "../../../src/resources.js";
import { PackageSmoke } from "../../../src/services/commands/package-smoke.js";
import { AppImageCopyRunnerFixture } from "../../fixtures/app-image-copy-runner.fixture.js";
import { InstalledAppFixture } from "../../fixtures/installed-app.fixture.js";
import { PausedClockFixture } from "../../fixtures/paused-clock.fixture.js";
import { RecordingTemporaryFolderFixture } from "../../fixtures/recording-temporary-folder.fixture.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";
import { SmokeRunnerFixture } from "../../fixtures/smoke-runner.fixture.js";
import { WatchPathsFixture } from "../../fixtures/watch-paths.fixture.js";

class FuseWireRunner extends SmokeRunnerFixture {
  private readonly wire: readonly number[];

  public constructor(wire: readonly number[]) {
    super();
    this.wire = wire;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv):
    Promise<ProcessResult> {
    const result = await super.captureAsync(command, commandArguments, directory, timeout, environment);
    if (path.basename(command) === `${SmokeRunnerFixture.PRODUCT_NAME}-1.2.3-linux-x64.AppImage`)
      await writeFile(path.join(directory, "squashfs-root", SmokeRunnerFixture.SLUG), Buffer.concat([Buffer.from("electron-program-"), Resources.electronFuseSentinel, Buffer.from(this.wire)]));
    return result;
  }
}

@TestClass
export class PackageSmokeTests {
  private static readonly APP_IMAGE: string = "_build/package/out/Sample App-1.2.3-linux-x64.AppImage";
  private static readonly ELF: Buffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01]);
  private static readonly RENDERER: number = SmokeRunnerFixture.MAIN + 2;
  private static readonly RESTRICTION: string = "/proc/sys/kernel/apparmor_restrict_unprivileged_userns";

  @TestMethod
  public async answersAnotherOptionOrMoreThanOneWithItsUsageAsync(): Promise<void> {
    for (const smokeArguments of [["--quick"], ["--remove-leftover", "--remove-leftover"], ["--deb", "--remove-leftover"], ["--deb", "--no-sandbox", "--require-sandbox"],
      ["--no-sandbox", "--deb"], ["--pkg", "--no-sandbox"], ["--pkg", "--deb"], ["--deb", "--pkg"]]) {
      const result = await PackageSmokeTests.runAsync(tmpdir(), smokeArguments);

      Assert.areEqual(2, result.exitCode);
      Assert.areEqual(Resources.smokeUsage, result.output);
    }
  }

  @TestMethod
  public async findsNothingLeftOverOutsideWindowsAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture();

    const result = await PackageSmokeTests.runAsync(tmpdir(), ["--remove-leftover"], runner);

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual(`${Resources.smokeNothingLeft}\n`, result.output);
    Assert.areEqual(0, runner.captured.length);
  }

  @TestMethod
  public async reportsAnAppItCannotReadWithoutCreatingAFolderAsync(): Promise<void> {
    await using parent = await PackageSmokeTests.createParentAsync();
    const folders = new RecordingTemporaryFolderFixture(parent.path);

    const result = await PackageSmokeTests.runAsync(path.join(parent.path, "missing"), [], new ScriptedRunnerFixture(), folders);

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(`${Resources.rootVersionInvalid}\n`, result.output);
    Assert.areEqual(0, folders.created.length);
  }

  @TestMethod
  public async removesItsFolderAfterAPackageThatDoesNotUnpackAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    await app.writeAppFileAsync(PackageSmokeTests.APP_IMAGE, "package");
    const folders = new RecordingTemporaryFolderFixture(parent.path);
    const runner = new ScriptedRunnerFixture();

    const result = await PackageSmokeTests.runAsync(app.path, [], runner, folders, { WINDOWS_PUBLISHER: "CN=Sample" });

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(1, runner.captured.length);
    Assert.isTrue(runner.captured[0]?.startsWith("Sample App-1.2.3-linux-x64.AppImage --appimage-extract") ?? false, runner.captured.join("|"));
    Assert.areEqual(JSON.stringify(folders.created), JSON.stringify(folders.removed));
    Assert.isFalse(folders.created.some(t => existsSync(t)));
  }

  @TestMethod
  public async reportsAFolderItCannotRemoveAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    await app.writeAppFileAsync(PackageSmokeTests.APP_IMAGE, "package");
    const folders = new RecordingTemporaryFolderFixture(parent.path, null, new Error("the folder is in use"));

    const result = await PackageSmokeTests.runAsync(app.path, [], new ScriptedRunnerFixture(), folders);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(`Cleaning up failed:\nThe smoke's folder ${folders.created[0] ?? String.empty} could not be removed: Error: the folder is in use\n`), result.output);
  }

  @TestMethod
  public async removesItsFolderAndThrowsAFailureThatIsNotTheSmokesOwnAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const folders = new RecordingTemporaryFolderFixture(parent.path);
    const smoke = new PackageSmoke(app.path, "linux", "x64", new ScriptedRunnerFixture(), folders, "/proc", {}, new PassThrough());

    const error = await Assert.throwsAsync(() => smoke.runAsync([]), Error);

    Assert.isFalse(error instanceof BuildException, error.message);
    Assert.areEqual(1, folders.removed.length);
  }

  @TestMethod
  public async throwsAFailureToCreateItsFolderAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const failure = new Error("no space left");
    const smoke = new PackageSmoke(app.path, "linux", "x64", new ScriptedRunnerFixture(), new RecordingTemporaryFolderFixture(tmpdir(), failure), "/proc", {}, new PassThrough());

    const error = await Assert.throwsAsync(() => smoke.runAsync([]), Error);

    Assert.areEqual(failure, error);
  }

  @TestMethod
  public async removesWhatAnEarlierRunLeftInstalledOnWindowsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const installed = path.join(parent.path, "local", "Programs", SmokeRunnerFixture.SLUG);
    const bin = path.join(installed, "bin");
    await mkdir(installed, { recursive: true });
    await writeFile(path.join(installed, "left.txt"), "left");
    const runner = new SmokeRunnerFixture();
    runner.userPath = `${SmokeRunnerFixture.PATH};${bin}`;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "win32", runner, ["--remove-leftover"], PackageSmokeTests.windowsEnvironment(parent.path));

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(Resources.formatOutputLine(Resources.formatLeftoverRemoved([installed, Resources.formatUserPathEntry(bin)])), result.output);
    Assert.isFalse(existsSync(installed));
    Assert.areEqual(SmokeRunnerFixture.PATH, runner.userPath);
  }

  @TestMethod
  public async smokesAWindowsInstallThroughPowerShellAndUninstallsItAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const installed = path.join(parent.path, "local", "Programs", SmokeRunnerFixture.SLUG);
    const bin = path.join(installed, "bin");
    const runner = new SmokeRunnerFixture();
    runner.publisher = "CN=Sample";
    const paths: string[] = [];
    runner.answer = (name, _, environment) => {
      if (name === "pwsh")
        paths.push(environment?.["PATH"] ?? String.empty);
      return null;
    };
    const environment: NodeJS.ProcessEnv = { ...PackageSmokeTests.windowsEnvironment(parent.path), WINDOWS_PUBLISHER: "CN=Sample" };

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "win32", runner, [], environment);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual([
      Resources.formatOutputLine(Resources.smokeNothingLeft),
      Resources.formatSmokeCookieEncryption(false),
      Resources.formatOutputLine(Resources.publisherMatchVerified),
      Resources.formatOutputLine(Resources.unpackedNoneVerified),
      Resources.formatSmokePathHolds(Resources.smokePathHoldsIntro, bin),
      Resources.formatSmokeNoRuntimeBeforeStart(SmokeRunnerFixture.SLUG),
      Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentAfterStart, "1.2.3", result.data),
      Resources.formatOutputLine(Resources.packagedModulesNone),
      Resources.formatOutputLine(Resources.formatWindowShown(SmokeRunnerFixture.PRODUCT_NAME)),
      Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentPowerShell, "1.2.3", result.data),
      Resources.smokeMainQuit,
      Resources.smokeRuntimeStopped,
      Resources.formatSmokePathHolds(Resources.smokePathHoldsAgainIntro, bin),
      Resources.smokeUninstalled
    ].join(String.empty), PackageSmokeTests.withoutTimes(result.output));
    Assert.isTrue(result.output.includes(` s: ${path.join(installed, `${SmokeRunnerFixture.PRODUCT_NAME}.exe`)}\n`), result.output);
    Assert.isTrue(runner.captured.includes(`pwsh -NoProfile -NonInteractive -Command ${Resources.formatPowerShellStatusLine(SmokeRunnerFixture.SLUG,
      path.join(result.folder, "device"), result.data)}`), runner.captured.join("\n"));
    Assert.areEqual(`${bin};/usr/bin`, paths.join("|"));
    Assert.isTrue(Object.isUndefined(environment["WINDOWS_PUBLISHER"]));
    Assert.areEqual(SmokeRunnerFixture.PATH, runner.userPath);
    Assert.isFalse(existsSync(installed));
  }

  @TestMethod
  public async refusesAPathThatHoldsTheCommandOtherThanOnceOrChangesAfterTheUninstallAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const bin = path.join(parent.path, "local", "Programs", SmokeRunnerFixture.SLUG, "bin");
    const unlisted = new SmokeRunnerFixture();
    unlisted.addsToPath = false;
    const kept = new SmokeRunnerFixture();
    kept.uninstallKeepsPath = true;

    const missing = await PackageSmokeTests.smokeAsync(app, parent.path, "win32", unlisted, [], PackageSmokeTests.windowsEnvironment(parent.path));
    const changed = await PackageSmokeTests.smokeAsync(app, parent.path, "win32", kept, [], PackageSmokeTests.windowsEnvironment(parent.path));

    Assert.areEqual(1, missing.exitCode);
    Assert.isTrue(missing.output.endsWith(Resources.formatOutputLine(Resources.formatSmokePathCount(bin, 0, SmokeRunnerFixture.PATH))), missing.output);
    Assert.areEqual(1, changed.exitCode);
    Assert.isTrue(changed.output.endsWith(Resources.formatOutputLine(Resources.formatSmokePathChanged(`${SmokeRunnerFixture.PATH};${bin}`, SmokeRunnerFixture.PATH))),
      changed.output);
  }

  @TestMethod
  public async reportsAPowerShellStatusThatFailsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    runner.answer = name => name === "pwsh" ? new ProcessResult(1, String.empty, "The term 'sample-app' is not recognized.") : null;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "win32", runner, [], PackageSmokeTests.windowsEnvironment(parent.path));

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(Resources.formatOutputLine(Resources.formatSmokePowerShellFailed(SmokeRunnerFixture.SLUG, 1,
      "The term 'sample-app' is not recognized."))), result.output);
    Assert.areEqual("SIGKILL", runner.main?.signals.join("|"));
  }

  @TestMethod
  public async marksThePackageReportStartedOnlyAfterARunThatPassesAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const report = await app.writeAppFileAsync(`_build/package/${Resources.packageReportFile}`, String.empty);
    await new PackageReport("macos-x64", false, false).writeAsync(report);

    const failed = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", PackageSmokeTests.createEndingRunner());
    const afterFailure = PackageReport.parse(JsonReader.parse(await readFile(report, "utf8")));
    const passed = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", new SmokeRunnerFixture());
    const afterPass = PackageReport.parse(JsonReader.parse(await readFile(report, "utf8")));

    Assert.areEqual(1, failed.exitCode, failed.output);
    Assert.isFalse(afterFailure?.isStarted ?? true);
    Assert.areEqual(0, passed.exitCode, passed.output);
    Assert.isTrue(afterPass?.isStarted ?? false);
  }

  @TestMethod
  public async smokesAMacOsCopyThroughALinkToItsCommandAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", runner);

    const bundle = path.join(result.folder, `${SmokeRunnerFixture.PRODUCT_NAME}.app`);
    const command = path.join(bundle, "Contents", "Resources", "bin", SmokeRunnerFixture.SLUG);
    const screenshot = path.join(app.path, "_build", "package", "smoke", "window-macos-x64.png");
    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual([
      Resources.formatOutputLine(Resources.formatNativeArchitectureVerified(bundle, 1, "x64")),
      Resources.formatSmokeCookieEncryption(false),
      Resources.formatOutputLine(Resources.publisherNoneVerified),
      Resources.formatOutputLine(Resources.unpackedNoneVerified),
      Resources.formatSmokeNoRuntimeBeforeStart(SmokeRunnerFixture.SLUG),
      Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentAfterStart, "1.2.3", result.data),
      Resources.formatOutputLine(Resources.packagedModulesNone),
      Resources.formatOutputLine(Resources.formatWindowShown(SmokeRunnerFixture.PRODUCT_NAME)),
      Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentLink, "1.2.3", result.data),
      Resources.formatSmokeScreenCaptured(screenshot),
      Resources.smokeMainQuit,
      Resources.smokeRuntimeStopped
    ].join(String.empty), PackageSmokeTests.withoutTimes(result.output));
    Assert.isTrue(runner.captured.includes(`ln -s ${command} ${path.join(result.folder, SmokeRunnerFixture.SLUG)}`), runner.captured.join("\n"));
    Assert.isTrue(runner.captured.includes(`screencapture -x ${screenshot}`), runner.captured.join("\n"));
    Assert.isTrue(existsSync(path.dirname(screenshot)));
    Assert.isTrue(runner.environments.some(t => t["ELECTRON_RUN_AS_NODE"] === "1"));
  }

  @TestMethod
  public async keepsNoPictureOfAScreenItCannotCaptureAndNamesWhyInTheSummaryAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const summary = path.join(parent.path, "summary.md");
    const runner = new SmokeRunnerFixture();
    runner.answer = name => name === "screencapture" ? new ProcessResult(1, String.empty, "could not create image from display") : null;
    const failure = new Error("the folder is in use");
    const folders = new RecordingTemporaryFolderFixture(parent.path, null, failure);

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", runner, [], { GITHUB_STEP_SUMMARY: summary }, folders);

    const reason = Resources.formatSmokeScreenNotCaptured(1, "could not create image from display");
    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.includes(`${reason}${Resources.smokeMainQuit}`), result.output);
    Assert.areEqual(reason, await readFile(summary, "utf8"));
    Assert.isTrue(result.output.endsWith(Resources.formatSmokeCleanUpFailed([Resources.formatSmokeFolderNotRemoved(result.folder, failure)])), result.output);
  }

  @TestMethod
  public async writesNoSummaryOfAScreenItCannotCaptureOutsideGitHubAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    runner.answer = name => name === "screencapture" ? new ProcessResult(1, String.empty, "could not create image from display") : null;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", runner);

    const reason = Resources.formatSmokeScreenNotCaptured(1, "could not create image from display");
    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(result.output.includes(`${reason}${Resources.smokeMainQuit}`), result.output);
    Assert.isFalse(existsSync(path.join(app.path, "_build", "package", "smoke", "window-macos-x64.png")));
  }

  @TestMethod
  public async reportsALinkedCommandThatFailsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    runner.answer = name => name === SmokeRunnerFixture.SLUG ? new ProcessResult(126, String.empty, "Permission denied") : null;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", runner);

    const command = path.join(result.folder, `${SmokeRunnerFixture.PRODUCT_NAME}.app`, "Contents", "Resources", "bin", SmokeRunnerFixture.SLUG);
    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeLinkFailed(SmokeRunnerFixture.SLUG, command, 126, "Permission denied"))),
      result.output);
  }

  @TestMethod
  public async reportsADiscoveryFileThatNamesNoProcessAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    runner.writesProcessId = false;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", runner);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeDiscoveryNamesNoProcess(path.join(result.data, "discovery", "runtime.json")))),
      result.output);
    Assert.areEqual("SIGKILL", runner.main?.signals.join("|"));
    Assert.areEqual(0, runner.killed.length);
  }

  @TestMethod
  public async reportsAQuitThatDoesNotEndTheMainProcessCleanlyAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const busy = new SmokeRunnerFixture();
    busy.quitOutcome = "Busy";
    const running = new SmokeRunnerFixture();
    running.quitExitCode = null;
    const failed = new SmokeRunnerFixture();
    failed.quitExitCode = 2;

    const answered = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", busy);
    const stayed = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", running);
    const ended = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", failed);

    const tail = (folder: string): string => Resources.formatSmokeLogTail(path.join(folder, "main.log"), "main started");
    Assert.areEqual("1 1 1", [answered.exitCode, stayed.exitCode, ended.exitCode].join(" "));
    Assert.isTrue(answered.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeQuitOutcomeWrong(SmokeRunnerFixture.SLUG, 0, "{\"outcome\":\"Busy\"}"))),
      answered.output);
    Assert.isTrue(stayed.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeMainDidNotExit(SmokeRunnerFixture.SLUG, tail(stayed.folder)))), stayed.output);
    Assert.areEqual("SIGKILL", running.main?.signals.join("|"));
    Assert.isTrue(ended.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeMainQuitBadly("exited with code 2", tail(ended.folder)))), ended.output);
    Assert.areEqual(0, failed.main?.signals.length);
  }

  @TestMethod
  public async killsARuntimeThatOutlivesTheMainProcessAndReportsOneThatSurvivesAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const stopping = new SmokeRunnerFixture();
    stopping.runtimeEndsWithMain = false;
    const surviving = new SmokeRunnerFixture();
    surviving.runtimeEndsWithMain = false;
    surviving.killStopsRuntime = false;

    const stopped = await PausedClockFixture.withoutPausesAsync(() => PackageSmokeTests.smokeAsync(app, parent.path, "darwin", stopping), Resources.smokePollInterval);
    const survived = await PausedClockFixture.withoutPausesAsync(() => PackageSmokeTests.smokeAsync(app, parent.path, "darwin", surviving), Resources.smokePollInterval);

    const outlived = (folder: string): string => Resources.formatOutputLine(Resources.formatSmokeRuntimeOutlived(SmokeRunnerFixture.RUNTIME,
      Resources.formatSmokeLogTail(path.join(folder, "main.log"), "main started")));
    Assert.areEqual(1, stopped.exitCode);
    Assert.isTrue(stopped.output.endsWith(outlived(stopped.folder)), stopped.output);
    Assert.areEqual(String(SmokeRunnerFixture.RUNTIME), stopping.killed.join("|"));
    Assert.areEqual(1, survived.exitCode);
    Assert.isTrue(survived.output.endsWith(`${outlived(survived.folder)}${Resources.formatSmokeCleanUpFailed([Resources.formatSmokeRuntimeNotEnded(SmokeRunnerFixture.RUNTIME)])}`),
      survived.output);
    Assert.areEqual(String(SmokeRunnerFixture.RUNTIME), surviving.killed.join("|"));
  }

  @TestMethod
  public async startsAnAppImageWithoutTheSandboxWhereTheNamespaceProbeFailsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const refusal = Resources.formatUserNamespaceRefusal(PackageSmokeTests.RESTRICTION, "1");

    for (const [name, value, reason] of [["open", "0", null], ["restricted", "1", refusal]] as const) {
      const processes = await PackageSmokeTests.createRestrictionAsync(path.join(parent.path, name), value);
      const runner = PackageSmokeTests.createEndingRunner();
      runner.answer = command => command === "unshare" ? new ProcessResult(1, String.empty, "unshare: Operation not permitted") : null;

      const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, [], {}, new RecordingTemporaryFolderFixture(parent.path), processes);

      const tail = Resources.formatSmokeLogTail(path.join(result.folder, "main.log"), "main started");
      Assert.areEqual(1, result.exitCode);
      Assert.areEqual([
        Resources.formatSmokeCookieEncryption(false),
        Resources.formatOutputLine(Resources.publisherNoneVerified),
        Resources.formatOutputLine(Resources.unpackedNoneVerified),
        Resources.formatSmokeNoRuntimeBeforeStart(SmokeRunnerFixture.SLUG),
        Resources.formatSmokeProbeFails(reason),
        Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentAfterStart, "1.2.3", result.data),
        Resources.formatOutputLine(Resources.packagedModulesNone),
        Resources.formatOutputLine(Resources.formatWindowMainEnded("exited with code 1", Resources.formatWindowUnreported(null), tail))
      ].join(String.empty), PackageSmokeTests.withoutTimes(result.output));
      Assert.areEqual(`${SmokeRunnerFixture.PRODUCT_NAME}-1.2.3-linux-x64.AppImage --device-dir=${path.join(result.folder, "device")} --data-dir=${result.data}`,
        runner.started.join("|"));
      Assert.isTrue(runner.captured.includes("unshare -Ur true"), runner.captured.join("\n"));
      Assert.areEqual(0, runner.killed.length);
    }
  }

  @TestMethod
  public async saysWhyTheNamespaceProbeRunsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const before = Resources.formatSmokeNoRuntimeBeforeStart(SmokeRunnerFixture.SLUG);

    for (const [name, value, reason] of [["open", "0", String.empty], ["restricted", "1", Resources.formatSmokeProbeRuns(`${PackageSmokeTests.RESTRICTION} is 1`)]] as const) {
      const processes = await PackageSmokeTests.createRestrictionAsync(path.join(parent.path, name), value);

      const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", PackageSmokeTests.createEndingRunner(), [], {}, new RecordingTemporaryFolderFixture(parent.path),
        processes);

      const after = Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentAfterStart, "1.2.3", result.data);
      Assert.areEqual(1, result.exitCode);
      Assert.isTrue(result.output.includes(`${before}${reason}${after}`), result.output);
    }
  }

  @TestMethod
  public async waitsForTheRenderersFilterWhereTheSandboxIsRequiredAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();

    const result = await PausedClockFixture.withoutPausesAsync(() => PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, true,
      Resources.smokeRequireSandboxOption), Resources.smokePollInterval);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.includes(Resources.smokeRequireSandboxNotice), result.output);
    Assert.isTrue(result.output.endsWith(Resources.formatOutputLine(Resources.formatSandboxMustBeOn(SmokeRunnerFixture.MAIN, true, "renderer 0"))), result.output);
    Assert.areEqual("SIGKILL", runner.main?.signals.join("|"));
  }

  @TestMethod
  public async takesTheSandboxFromItsOptionWithoutTheProbeAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const before = Resources.formatSmokeNoRuntimeBeforeStart(SmokeRunnerFixture.SLUG);

    for (const [option, notice, isOff] of [
      ["--no-sandbox", Resources.smokeNoSandboxNotice, true],
      ["--require-sandbox", Resources.smokeRequireSandboxNotice, false],
      ["--require-fallback", Resources.smokeRequireFallbackNotice, false]
    ] as const) {
      const runner = PackageSmokeTests.createEndingRunner();

      const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, [option]);

      Assert.areEqual(1, result.exitCode);
      Assert.isTrue(result.output.includes(`${before}${notice}${Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentAfterStart, "1.2.3",
        result.data)}`), result.output);
      Assert.areEqual(isOff, runner.started.join("|").endsWith(" --no-sandbox"));
      Assert.isFalse(runner.captured.some(t => t.startsWith("unshare")));
    }
  }

  @TestMethod
  public async smokesAnInstalledDebianPackageAndRemovesItAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new SmokeRunnerFixture();
    runner.debianFolder = path.join(parent.path, "opt", "Sample App").replaceAll("\\", "/");
    const program = `${runner.debianFolder}/${SmokeRunnerFixture.SLUG}`;
    const profile = "/etc/apparmor.d/sample-app";

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, ["--deb", "--no-sandbox"], {}, new RecordingTemporaryFolderFixture(parent.path), processes);

    const file = path.join(app.path, "_build", "package", "out", "Sample App-1.2.3-linux-x64.deb");
    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual([
      Resources.formatOutputLine([
        Resources.formatDebianSandboxHelperChecked(`${runner.debianFolder}/chrome-sandbox`, "0:755", true),
        Resources.formatDebianProfileInstalled(profile),
        Resources.formatDebianPackageTypeChecked(`${runner.debianFolder}/resources/package-type`)
      ].join("\n")),
      Resources.formatSmokeCookieEncryption(false),
      Resources.formatOutputLine(Resources.publisherNoneVerified),
      Resources.formatOutputLine(Resources.unpackedNoneVerified),
      Resources.formatSmokeNoRuntimeBeforeStart(SmokeRunnerFixture.SLUG),
      Resources.smokeNoSandboxNotice,
      Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentAfterStart, "1.2.3", result.data),
      Resources.formatOutputLine(Resources.packagedModulesNone),
      Resources.formatOutputLine(Resources.formatWindowShown(SmokeRunnerFixture.PRODUCT_NAME)),
      Resources.formatOutputLine(Resources.formatSandboxOff("renderer 0")),
      Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentDebianCommand, "1.2.3", result.data),
      Resources.smokeMainQuit,
      Resources.smokeRuntimeStopped,
      Resources.formatOutputLine(Resources.formatDebianRemoved(SmokeRunnerFixture.SLUG, runner.debianFolder, profile))
    ].join(String.empty), PackageSmokeTests.withoutTimes(result.output));
    Assert.isTrue(result.output.includes(` s: ${program}\n`), result.output);
    Assert.areEqual(`${SmokeRunnerFixture.SLUG} --device-dir=${path.join(result.folder, "device")} --data-dir=${result.data} --no-sandbox`, runner.started.join("|"));
    Assert.isTrue(runner.captured.includes(`sudo --non-interactive apt-get -o DPkg::Lock::Timeout=60 install --yes ${file}`), runner.captured.join("\n"));
    Assert.areEqual(1, runner.captured.filter(t => t === "sudo --non-interactive apt-get -o DPkg::Lock::Timeout=60 remove --yes sample-app").length);
    Assert.isFalse(runner.captured.some(t => t.startsWith("unshare") || t.startsWith(`${SmokeRunnerFixture.PRODUCT_NAME}-1.2.3-linux-x64.AppImage`)), runner.captured.join("\n"));
    Assert.isFalse(existsSync(runner.debianFolder));
    Assert.isFalse(existsSync(result.folder));
  }

  @TestMethod
  public async requiresTheSandboxOfADebianPackageAndRemovesItWhenTheSmokeFailsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const removed = Resources.formatOutputLine(Resources.formatDebianRemoved(SmokeRunnerFixture.SLUG, `${parent.path.replaceAll("\\", "/")}/opt/Sample App`,
      "/etc/apparmor.d/sample-app"));

    for (const [smokeArguments, notice] of [[["--deb"], Resources.smokeDebianSandboxNotice], [["--deb", "--require-fallback"], Resources.smokeRequireFallbackNotice]] as const) {
      const runner = PackageSmokeTests.createEndingRunner();
      runner.debianFolder = path.join(parent.path, "opt", "Sample App").replaceAll("\\", "/");

      const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, smokeArguments);

      Assert.areEqual(1, result.exitCode);
      Assert.isTrue(result.output.includes(`${Resources.formatSmokeNoRuntimeBeforeStart(SmokeRunnerFixture.SLUG)}${notice}`), result.output);
      Assert.isTrue(result.output.endsWith(removed), result.output);
      Assert.isFalse(runner.started.join("|").endsWith(" --no-sandbox"));
      Assert.isFalse(runner.captured.some(t => t.startsWith("unshare")));
      Assert.isFalse(existsSync(runner.debianFolder));
    }
  }

  @TestMethod
  public async refusesADebianCommandThatCannotAnswerWithNoDisplayAndRemovesThePackageAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new SmokeRunnerFixture();
    runner.debianFolder = path.join(parent.path, "opt", "Sample App").replaceAll("\\", "/");
    const refusal = new ProcessResult(5, String.empty, "Missing X server or $DISPLAY");
    const environments: NodeJS.ProcessEnv[] = [];
    runner.answer = (name, commandArguments, environment) => {
      if (name !== SmokeRunnerFixture.SLUG || commandArguments[0] !== "status")
        return null;
      environments.push(environment ?? {});
      return refusal;
    };

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, ["--deb", "--no-sandbox"], { DISPLAY: ":0", WAYLAND_DISPLAY: "wayland-0", KEPT: "kept" },
      new RecordingTemporaryFolderFixture(parent.path), processes);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.includes(Resources.formatSmokeWindowlessCommandFailed(SmokeRunnerFixture.SLUG, Resources.smokeMomentDebianCommand, 5, refusal.text)), result.output);
    Assert.areEqual(1, environments.length);
    Assert.isUndefined(environments[0]?.["DISPLAY"]);
    Assert.isUndefined(environments[0]?.["WAYLAND_DISPLAY"]);
    Assert.areEqual("kept", environments[0]?.["KEPT"]);
    Assert.isTrue(runner.environments.some(t => t["DISPLAY"] === ":0"), "the other commands keep the display");
    Assert.isFalse(existsSync(runner.debianFolder));
  }

  @TestMethod
  public async reportsADebianPackageItCannotRemoveAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = PackageSmokeTests.createEndingRunner();
    runner.debianFolder = path.join(parent.path, "opt", "Sample App").replaceAll("\\", "/");
    runner.answer = (name, commandArguments) => name === "sudo" && commandArguments.includes("remove") ? new ProcessResult(100, String.empty, "locked") : null;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, ["--deb"]);

    const error = new BuildException(Resources.formatProcessFailed("sudo", ["--non-interactive", "apt-get", ...Resources.aptGetRemoveArguments, SmokeRunnerFixture.SLUG], 100, "locked"));
    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(Resources.formatSmokeCleanUpFailed([Resources.formatSmokeSystemInstallNotRemoved(SmokeRunnerFixture.SLUG, error)])), result.output);
    Assert.isFalse(existsSync(result.folder));
  }

  @TestMethod
  public async refusesToInstallAMacInstallerPackageForAnAppThatNamesNoFolderOrOffMacOsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();

    for (const platform of ["darwin", "linux"]) {
      const runner = new SmokeRunnerFixture();

      const result = await PackageSmokeTests.smokeAsync(app, parent.path, platform, runner, ["--pkg"]);

      Assert.areEqual(1, result.exitCode, platform);
      Assert.areEqual(Resources.formatOutputLine(Resources.smokeMacInstallerNotFoldered), result.output, platform);
      Assert.areEqual(0, runner.captured.length, platform);
    }
  }

  @TestMethod
  public async installsTheInstallerPackageOfAnAppThatNamesAFolderAndStopsWhenTheInstallerFailsAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ installFolder: "Sample Makers" });
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    runner.answer = (name, commandArguments) => name === "sudo" && commandArguments.includes("installer") ? new ProcessResult(1, String.empty, "installer: refused") : null;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", runner, ["--pkg"]);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.includes("installer: refused"), result.output);
    Assert.areEqual(["sudo --non-interactive mkdir -p /Applications/Sample Makers/Smoke Neighbour.app",
      `sudo --non-interactive installer -pkg ${path.join(app.path, "_build", "package", "out", "Sample App-1.2.3-macos-x64.pkg")} -target /`].join("\n"),
    runner.captured.filter(t => t.startsWith("sudo")).join("\n"));
  }

  @TestMethod
  public async checksTheNeighbourAfterAnInstallAndRemovesBothWhenTheSmokeFailsAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ installFolder: "Sample Makers" });
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();

    const error = await Assert.throwsAsync(() => PackageSmokeTests.smokeAsync(app, parent.path, "darwin", runner, ["--pkg"]), Error);

    Assert.isTrue(error.message.includes(path.join("/Applications/Sample Makers/Sample App.app")), error.message);
    Assert.areEqual(["test -e /Applications/Sample Makers/Smoke Neighbour.app",
      "sudo --non-interactive rm -rf /Applications/Sample Makers/Sample App.app /Applications/Sample Makers/Smoke Neighbour.app",
      "sudo --non-interactive pkgutil --forget com.example.sample"].join("\n"),
      runner.captured.filter(t => t.startsWith("sudo") || t.startsWith("test -e")).slice(-3).join("\n"));
  }

  @TestMethod
  public async refusesToSmokeADebianPackageOffLinuxAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "darwin", runner, ["--deb"]);

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(Resources.formatOutputLine(Resources.smokeDebianNotLinux), result.output);
    Assert.areEqual(0, runner.captured.length);
    Assert.areEqual(String.empty, result.folder);
  }

  @TestMethod
  public async refusesCookieEncryptionThatDoesNotMatchTheWebViewsOrAProgramWithoutFusesAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const encrypted = new SmokeRunnerFixture();
    encrypted.isCookieEncrypted = true;
    const unwired = new SmokeRunnerFixture();
    unwired.hasFuseWire = false;

    const first = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", encrypted);
    const second = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", unwired);

    const program = (folder: string): string => path.join(folder, "squashfs-root", SmokeRunnerFixture.SLUG);
    Assert.areEqual(1, first.exitCode);
    Assert.isTrue(first.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeCookiesEncrypted(program(first.folder)))), first.output);
    Assert.areEqual(1, second.exitCode);
    Assert.isTrue(second.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeNoFuseWire(program(second.folder), 1))), second.output);
    Assert.areEqual(0, encrypted.started.length + unwired.started.length);
  }

  @TestMethod
  public async refusesAFuseWireOfAnotherVersionOrWithoutTheCookieFuseSetOnOrOffAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();

    for (const wire of [[2, 2, 0x31, 0x30], [1, 1, 0x31, 0x30], [1], [1, 2, 0x31, 0x32]]) {
      const runner = new FuseWireRunner(wire);

      const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner);

      const program = path.join(result.folder, "squashfs-root", SmokeRunnerFixture.SLUG);
      Assert.areEqual(1, result.exitCode, wire.join(","));
      Assert.areEqual(Resources.formatOutputLine(Resources.formatSmokeNoFuseWire(program, Resources.cookieEncryptionFuse)), PackageSmokeTests.withoutTimes(result.output));
      Assert.areEqual(0, runner.started.length);
    }
  }

  @TestMethod
  public async encryptsCookiesForAModuleThatDeclaresWebViewsAndRefusesAProgramThatDoesNotAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    await PackageSmokeTests.addWebViewModuleAsync(app);
    const encrypted = new SmokeRunnerFixture();
    encrypted.isCookieEncrypted = true;
    const unencrypted = new SmokeRunnerFixture();

    const kept = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", encrypted, [Resources.chromiumNoSandboxOption]);
    const refused = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", unencrypted, [Resources.chromiumNoSandboxOption]);

    const program = path.join(refused.folder, "squashfs-root", SmokeRunnerFixture.SLUG);
    Assert.isTrue(PackageSmokeTests.withoutTimes(kept.output).startsWith(`${Resources.formatSmokeCookieEncryption(true)}${Resources.formatOutputLine(Resources.publisherNoneVerified)}`), kept.output);
    Assert.areEqual(1, refused.exitCode);
    Assert.areEqual(Resources.formatOutputLine(Resources.formatSmokeCookiesUnencrypted(program)), PackageSmokeTests.withoutTimes(refused.output));
    Assert.areEqual(0, unencrypted.started.length);
  }

  @TestMethod
  public async reportsADiscoveryFileItCannotReadWhileCleaningUpAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    runner.isCookieEncrypted = true;
    runner.discoveryIsFolder = true;
    const folders = new RecordingTemporaryFolderFixture(parent.path);

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, [], {}, folders);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.includes(`Cleaning up failed:\nThe runtime's discovery file in ${result.folder} could not be read: Error: EISDIR`), result.output);
    Assert.areEqual(1, folders.removed.length);
  }

  @TestMethod
  public async reportsARuntimeItCannotCheckWhileCleaningUpAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = PackageSmokeTests.createEndingRunner();
    const failure = new Error("the process table is unreadable");
    runner.runningFailure = failure;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, [Resources.chromiumNoSandboxOption]);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(Resources.formatSmokeCleanUpFailed([Resources.formatSmokeRuntimeEndFailed(SmokeRunnerFixture.RUNTIME, failure)])), result.output);
  }

  @TestMethod
  public async refusesAStatusThatIsNotNoRuntimeBeforeTheStartAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    runner.answer = (_, commandArguments) => commandArguments.includes("status") ? new ProcessResult(0, "already running", String.empty) : null;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeStatusNotNoRuntime(SmokeRunnerFixture.SLUG, Resources.smokeMomentBeforeStart, 0,
      "already running"))), result.output);
    Assert.areEqual(0, runner.started.length);
  }

  @TestMethod
  public async reportsAMainProcessThatEndsBeforeItsRuntimeAnswersAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    runner.startsRuntime = false;
    runner.mainExitCode = 1;

    const result = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, [Resources.chromiumNoSandboxOption]);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeMainEndedBeforeRuntime("exited with code 1",
      Resources.formatSmokeLogTail(path.join(result.folder, "main.log"), "main started")))), result.output);
  }

  @TestMethod
  public async reportsARuntimeThatNeverAnswersAndEndsTheMainProcessAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    runner.startsRuntime = false;

    const result = await PausedClockFixture.withoutPausesAsync(() => PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, [Resources.chromiumNoSandboxOption]),
      Resources.smokePollInterval);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeRuntimeNoAnswer(SmokeRunnerFixture.SLUG, 3, "No runtime is running.",
      Resources.formatSmokeLogTail(path.join(result.folder, "main.log"), "main started")))), result.output);
    Assert.areEqual("SIGKILL", runner.main?.signals.join("|"));
    Assert.areEqual(0, runner.killed.length);
  }

  @TestMethod
  public async refusesAStatusWithoutAVersionOrWithAnotherAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const unversioned = new SmokeRunnerFixture();
    unversioned.version = null;
    const other = new SmokeRunnerFixture();
    other.version = "9.9.9";

    const incomplete = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", unversioned, [Resources.chromiumNoSandboxOption]);
    const mismatched = await PackageSmokeTests.smokeAsync(app, parent.path, "linux", other, [Resources.chromiumNoSandboxOption]);

    const answer = JSON.stringify({ dataDirectory: incomplete.data, modules: [], window: unversioned.window });
    Assert.areEqual(1, incomplete.exitCode);
    Assert.isTrue(incomplete.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeStatusIncomplete(SmokeRunnerFixture.SLUG, answer))), incomplete.output);
    Assert.areEqual(1, mismatched.exitCode);
    Assert.isTrue(mismatched.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeStatusMismatch(SmokeRunnerFixture.SLUG, "9.9.9", mismatched.data, "1.2.3",
      mismatched.data))), mismatched.output);
  }

  @TestMethod
  public async waitsForAWindowThatPaintsAfterTheFirstLookAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const runner = new SmokeRunnerFixture();
    const shown = runner.window;
    runner.window = { title: SmokeRunnerFixture.PRODUCT_NAME, isVisible: true, isPainted: false };
    let statuses = 0;
    runner.answer = (_, commandArguments) => {
      if (commandArguments.includes("status"))
        statuses += 1;
      if (statuses === 4)
        runner.window = shown;
      return null;
    };

    const result = await PausedClockFixture.withoutPausesAsync(() => PackageSmokeTests.smokeAsync(app, parent.path, "darwin", runner), Resources.smokePollInterval);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(result.output.includes(Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentAfterStart, "1.2.3", result.data)
      + Resources.formatOutputLine(Resources.packagedModulesNone) + Resources.formatOutputLine(Resources.formatWindowShown(SmokeRunnerFixture.PRODUCT_NAME))), result.output);
    Assert.isTrue(statuses > 4, String(statuses));
  }

  @TestMethod
  public async smokesAnAppImageWhoseRuntimeRunsFromItsOwnExtractionAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();

    const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, true);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual([
      Resources.formatSmokeCookieEncryption(false),
      Resources.formatOutputLine(Resources.publisherNoneVerified),
      Resources.formatOutputLine(Resources.unpackedNoneVerified),
      Resources.formatSmokeNoRuntimeBeforeStart(SmokeRunnerFixture.SLUG),
      Resources.smokeNoSandboxNotice,
      Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentAfterStart, "1.2.3", result.data),
      Resources.formatOutputLine(Resources.packagedModulesNone),
      Resources.formatOutputLine(Resources.formatWindowShown(SmokeRunnerFixture.PRODUCT_NAME)),
      Resources.formatOutputLine(Resources.formatSandboxOff("renderer 0")),
      Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentAppImageCommandLine, "1.2.3", result.data),
      Resources.formatSmokeExtraction(path.join(result.folder, "extraction"), AppImageCopyRunnerFixture.EXTRACTED_BYTES),
      Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentReplaced, "1.2.3", result.data),
      Resources.smokeMainQuit,
      Resources.smokeRuntimeStopped,
      Resources.formatSmokeCopyEnded(Resources.smokeMomentStopped)
    ].join(String.empty), PackageSmokeTests.withoutTimes(result.output));
    Assert.areEqual("package", await readFile(path.join(app.path, PackageSmokeTests.APP_IMAGE), "utf8"));
    Assert.isFalse(existsSync(path.join(app.path, `${PackageSmokeTests.APP_IMAGE}.replacement`)));
    Assert.isTrue(runner.captured.includes(`${SmokeRunnerFixture.PRODUCT_NAME}-1.2.3-linux-x64.AppImage --command-line status --json --device-dir ${path.join(result.folder, "device")} --data-dir ${result.data}`),
      runner.captured.join("\n"));
    Assert.isFalse(existsSync(result.folder));
  }

  @TestMethod
  public async refusesAProgramItCannotReadOrAStatusThatFailsOnceTheAppImageIsReplacedAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const script = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "script"), Buffer.from("#!/bin/sh\n"));
    const elf = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const reading = new AppImageCopyRunnerFixture();
    const failing = new AppImageCopyRunnerFixture();
    let statuses = 0;
    failing.answer = (_, commandArguments) => {
      if (commandArguments.includes("status"))
        statuses += 1;
      return commandArguments.includes("status") && statuses === 5 ? new ProcessResult(1, String.empty, "The runtime is gone.") : null;
    };

    const unreadable = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, reading, script, true);
    const failed = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, failing, elf, true);

    const program = await readlink(path.join(script, String(SmokeRunnerFixture.RUNTIME), "exe"));
    Assert.areEqual(1, unreadable.exitCode);
    Assert.isTrue(unreadable.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeProgramUnreadable(program))), unreadable.output);
    Assert.areEqual("SIGKILL", reading.main?.signals.join("|"));
    Assert.areEqual(1, failed.exitCode);
    Assert.isTrue(failed.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeStatusAfterReplace(SmokeRunnerFixture.SLUG, 1, "The runtime is gone."))),
      failed.output);
    Assert.areEqual("SIGKILL", failing.main?.signals.join("|"));
  }

  @TestMethod
  public async refusesExtractionRecordsThatDoNotNameOneExtractionThatIsThereAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);

    for (const [records, count] of [[[], 0], [["missing"], 1], [["text"], 1], [["extraction", "extraction"], 2]] as const) {
      const runner = new AppImageCopyRunnerFixture();
      runner.records = records;

      const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, true);

      Assert.areEqual(1, result.exitCode);
      Assert.isTrue(result.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeExtractionRecords(path.join(result.data, "logs"), count))), result.output);
      Assert.isFalse(result.output.includes(Resources.formatSmokeStatusReported(SmokeRunnerFixture.SLUG, Resources.smokeMomentReplaced, "1.2.3", result.data)),
        result.output);
    }
  }

  @TestMethod
  public async refusesCopyRecordsBesideAMountedCopyAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.records = ["text", "folder"];

    const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, false);

    const records = result.output.split(Resources.formatSmokeMountedCopyRecords(path.join(result.data, "logs"), 2, []));
    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(2, records.length, result.output);
    Assert.isTrue(records[1]?.includes(AppImageCopyRunnerFixture.RECORD_TEXT) ?? false, result.output);
    Assert.isTrue(records[1]?.includes("EISDIR") ?? false, result.output);
  }

  @TestMethod
  public async reportsACopyOfTheAppImageThatOutlivesItsRuntimeAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.removesCopy = false;

    const result = await PausedClockFixture.withoutPausesAsync(() => PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, true),
      Resources.smokePollInterval);

    const record = AppImageCopyRunnerFixture.formatRecord(path.join(result.data, "logs"), 0);
    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(`${Resources.smokeRuntimeStopped}${Resources.formatOutputLine(Resources.formatSmokeCopyLingered(Resources.smokeMomentStopped,
      [record, path.join(result.folder, "extraction")], String.empty))}`), result.output);
  }

  @TestMethod
  public async looksForTheRuntimesMountWithoutCopyRecordsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.records = [];
    const folders = new RecordingTemporaryFolderFixture(parent.path);

    const error = await Assert.throwsAsync(() => PackageSmokeTests.smokeAsync(app, parent.path, "linux", runner, [Resources.chromiumNoSandboxOption], {}, folders, processes), Error);

    Assert.isFalse(error instanceof BuildException, error.message);
    Assert.isTrue(error.message.includes(path.join(processes, String(SmokeRunnerFixture.RUNTIME), "fd", "0")), error.message);
    Assert.areEqual("SIGKILL", runner.main?.signals.join("|"));
    Assert.areEqual(JSON.stringify(folders.created), JSON.stringify(folders.removed));
  }

  @TestMethod
  public async reportsALauncherThatNeverConnectsToTheRuntimeAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const ending = new AppImageCopyRunnerFixture();
    ending.keepsStartLog = true;
    ending.mainExitCode = 1;
    const keeping = new AppImageCopyRunnerFixture();
    keeping.keepsStartLog = true;

    const ended = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, ending, processes, false);
    const [kept, wasWaitingBeforeTheLimit] = await PackageSmokeTests.smokeUntilTheLaunchLimitAsync(app, parent.path, keeping, processes);

    const tail = (folder: string): string => Resources.formatSmokeLogTail(path.join(folder, "main.log"), "main started");
    Assert.areEqual(1, ended.exitCode);
    Assert.isTrue(ended.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeMainEndedBeforeLauncher("exited with code 1", tail(ended.folder)))), ended.output);
    Assert.isTrue(wasWaitingBeforeTheLimit);
    Assert.areEqual(1, kept.exitCode);
    Assert.isTrue(kept.output.endsWith(Resources.formatOutputLine(Resources.formatSmokeLauncherKeptStartLog(path.join(kept.data, "logs"), tail(kept.folder)))),
      kept.output);
    Assert.areEqual("SIGKILL", keeping.main?.signals.join("|"));
  }

  @TestMethod
  public async waitsForALauncherThatRemovesItsStartLogOnlyOnceTheWaitBeganAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.removesStartLog = true;

    const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, true);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(PackageSmokeTests.withoutTimes(result.output).includes(Resources.formatSmokeExtraction(path.join(result.folder, "extraction"),
      AppImageCopyRunnerFixture.EXTRACTED_BYTES)), result.output);
    Assert.isFalse(existsSync(path.join(result.data, "logs", "start-00000000-0000-0000-0000-000000000000.log")));
  }

  @TestMethod
  public async watchesTheStartLogItselfNotItsFolderWhoseWatchMayMissARemovalAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.removesStartLog = true;
    using watches = new WatchPathsFixture();

    const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, true);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(JSON.stringify([path.join(result.data, "logs", "start-00000000-0000-0000-0000-000000000000.log")]), JSON.stringify(watches.paths));
  }

  @TestMethod
  public async seesTheStartLogsRemovalThatItsWatchNeverReportsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.removesStartLog = true;
    using watches = new WatchPathsFixture();
    watches.dropsEvents = true;

    const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, true);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(1, watches.paths.length);
    Assert.isFalse(existsSync(path.join(result.data, "logs", "start-00000000-0000-0000-0000-000000000000.log")));
  }

  @TestMethod
  public async goesOnWhenTheStartLogIsRemovedJustBeforeItsWatchStartsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.keepsStartLog = true;
    using watches = new WatchPathsFixture();
    watches.onWatch = target => rmSync(target);

    const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, true);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(1, watches.paths.length);
  }

  @TestMethod
  public async reportsAStartLogItCannotWatchAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.keepsStartLog = true;
    using watches = new WatchPathsFixture();
    watches.onWatch = () => {
      throw Object.assign(new Error("EMFILE: too many open files"), { code: "EMFILE" });
    };

    const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, false);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.includes(Resources.formatSmokeLogsUnwatchable(path.join(result.data, "logs"))), result.output);
    Assert.areEqual("SIGKILL", runner.main?.signals.join("|"));
  }

  @TestMethod
  public async goesOnWhenTheLauncherRemovesItsStartLogJustBeforeTheMainProcessExitsAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.removesStartLog = true;
    runner.exitsAfterRemovingStartLog = true;

    const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, true);

    const output = PackageSmokeTests.withoutTimes(result.output);
    Assert.isTrue(output.includes(Resources.formatSmokeExtraction(path.join(result.folder, "extraction"), AppImageCopyRunnerFixture.EXTRACTED_BYTES)), result.output);
    Assert.isFalse(output.includes(Resources.formatSmokeMainEndedBeforeLauncher("exited with code 0", Resources.formatSmokeLogTail(path.join(result.folder, "main.log"),
      "main started"))), result.output);
  }

  @TestMethod
  public async reportsALogsFolderItCannotWatchAsync(): Promise<void> {
    await using app = await PackageSmokeTests.createAppAsync();
    await using parent = await PackageSmokeTests.createParentAsync();
    const processes = await PackageSmokeTests.createProcessesAsync(path.join(parent.path, "elf"), PackageSmokeTests.ELF);
    const runner = new AppImageCopyRunnerFixture();
    runner.makesLogs = false;
    runner.records = [];

    const result = await PackageSmokeTests.smokeAppImageAsync(app, parent.path, runner, processes, false);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.includes(Resources.formatSmokeLogsUnwatchable(path.join(result.data, "logs"))), result.output);
    Assert.areEqual("SIGKILL", runner.main?.signals.join("|"));
  }

  private static async smokeUntilTheLaunchLimitAsync(app: InstalledAppFixture, parent: string, runner: AppImageCopyRunnerFixture, processes: string):
    Promise<readonly [Awaited<ReturnType<typeof PackageSmokeTests.smokeAppImageAsync>>, boolean]> {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
    try {
      let isWaiting = false;
      let isDone = false;
      void runner.launchWait.promise.then(() => {
        isWaiting = true;
      });
      const running = PackageSmokeTests.smokeAppImageAsync(app, parent, runner, processes, false);
      void running.then(() => {
        isDone = true;
      }, () => {
        isDone = true;
      });
      await PackageSmokeTests.tickUntilAsync(() => isWaiting);
      mock.timers.tick(Resources.smokeStartLimit - Resources.smokePollInterval);
      await new Promise<void>(resolve => setImmediate(resolve));
      const wasWaiting = !isDone;
      await PackageSmokeTests.tickUntilAsync(() => isDone);
      return [await running, wasWaiting];
    }
    finally {
      mock.timers.reset();
    }
  }

  private static async tickUntilAsync(condition: () => boolean): Promise<void> {
    for (;;) {
      await new Promise<void>(resolve => setImmediate(resolve));
      if (condition())
        return;
      mock.timers.tick(Resources.smokePollInterval);
    }
  }

  private static async createProcessesAsync(folder: string, program: Buffer): Promise<string> {
    const processes = path.join(folder, "proc");
    const file = path.join(folder, "program");
    const runtime = path.join(processes, String(SmokeRunnerFixture.RUNTIME));
    await mkdir(runtime, { recursive: true });
    await writeFile(file, program);
    for (const [id, parent, commandLine] of [
      [SmokeRunnerFixture.MAIN, 1, "/tmp/Sample.AppImage\0--no-sandbox\0"],
      [PackageSmokeTests.RENDERER, SmokeRunnerFixture.MAIN, "/tmp/.mount_Sample/sample-app\0--type=renderer\0"]
    ] as const) {
      await mkdir(path.join(processes, String(id)));
      await writeFile(path.join(processes, String(id), "status"), `Name:\tsample-app\nPPid:\t${parent}\nSeccomp:\t0\n`);
      await writeFile(path.join(processes, String(id), "cmdline"), commandLine);
    }
    await symlink(file, path.join(runtime, "exe"), "junction");
    return processes;
  }

  private static async createRestrictionAsync(folder: string, value: string): Promise<string> {
    const processes = path.join(folder, "proc");
    const file = path.join(processes, ...PackageSmokeTests.RESTRICTION.split("/").slice(2));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${value}\n`);
    return processes;
  }

  private static async addWebViewModuleAsync(app: InstalledAppFixture): Promise<void> {
    const manifest = path.join(app.path, "package.json");
    const root = JsonReader.parse(await readFile(manifest, "utf8"));
    await writeFile(manifest, JSON.stringify({ ...root.toJson(), desktop: { ...root.readObject("desktop").toJson(), modules: ["browser"] } }));
    await app.writeAppFileAsync("src/modules/browser/module.json", JSON.stringify({
      id: "browser",
      version: "0.0.1",
      displayName: "Browser",
      description: "Shows web pages.",
      parts: ["window"],
      dependencies: {},
      contributes: {}
    }));
    await app.writeAppFileAsync("src/modules/browser/window/src/api/index.ts", String.empty);
    await app.writeAppFileAsync("src/modules/browser/webViews.json", "{}");
  }

  private static smokeAppImageAsync(app: InstalledAppFixture, parent: string, runner: AppImageCopyRunnerFixture, processes: string, extractsAndRuns: boolean,
    option: string = Resources.chromiumNoSandboxOption): Promise<{ readonly exitCode: number; readonly output: string; readonly folder: string; readonly data: string }> {
    return PackageSmokeTests.smokeAsync(app, parent, "linux", runner, [option], extractsAndRuns ? { APPIMAGE_EXTRACT_AND_RUN: "1" } : {},
      new RecordingTemporaryFolderFixture(parent), processes);
  }

  private static async createAppAsync(): Promise<InstalledAppFixture> {
    const app = await InstalledAppFixture.createAsync();
    await app.writeAppFileAsync("_build/package/electron-builder.json", JSON.stringify({ asarUnpack: [] }));
    await app.writeAppFileAsync("_build/package/electron/ffmpeg.dll", "library");
    await app.writeAppFileAsync(PackageSmokeTests.APP_IMAGE, "package");
    return app;
  }

  private static createEndingRunner(): SmokeRunnerFixture {
    const runner = new SmokeRunnerFixture();
    runner.mainExitCode = 1;
    runner.window = null;
    return runner;
  }

  private static windowsEnvironment(parent: string): NodeJS.ProcessEnv {
    return { LOCALAPPDATA: path.join(parent, "local"), SystemRoot: "C:\\Windows", PATH: "/usr/bin" };
  }

  private static withoutTimes(output: string): string {
    return output.replace(/^Installed in \d+\.\d s: .*\n/m, String.empty);
  }

  private static async smokeAsync(app: InstalledAppFixture, parent: string, platform: string, runner: SmokeRunnerFixture, smokeArguments: readonly string[] = [],
    environment: NodeJS.ProcessEnv = {}, folders: RecordingTemporaryFolderFixture = new RecordingTemporaryFolderFixture(parent), processes: string = "/proc"):
    Promise<{ readonly exitCode: number; readonly output: string; readonly folder: string; readonly data: string }> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    const created = folders.created.length;
    const exitCode = await new PackageSmoke(app.path, platform, "x64", runner, folders, processes, environment, output).runAsync(smokeArguments);
    const folder = folders.created[created] ?? String.empty;
    return { exitCode, output: chunks.join(String.empty), folder, data: path.join(folder, "data") };
  }

  private static async createParentAsync(): Promise<{ readonly path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-package-smoke-"));
    return {
      path: folder,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    };
  }

  private static async runAsync(root: string, smokeArguments: readonly string[], runner: ScriptedRunnerFixture = new ScriptedRunnerFixture(),
    folders: RecordingTemporaryFolderFixture = new RecordingTemporaryFolderFixture(tmpdir()), environment: NodeJS.ProcessEnv = {}):
    Promise<{ readonly exitCode: number; readonly output: string }> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    const exitCode = await new PackageSmoke(root, "linux", "x64", runner, folders, "/proc", environment, output).runAsync(smokeArguments);
    return { exitCode, output: chunks.join(String.empty) };
  }
}
