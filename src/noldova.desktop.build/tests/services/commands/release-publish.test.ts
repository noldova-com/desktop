/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { ProcessTimeoutException } from "../../../src/exceptions/process-timeout.exception.js";
import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageReport } from "../../../src/models/packaging/package-report.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { SourceArchive } from "../../../src/models/packaging/source-archive.js";
import { Resources } from "../../../src/resources.js";
import { ReleasePublish } from "../../../src/services/commands/release-publish.js";
import { ReleaseFileSet } from "../../../src/services/release/release-file-set.js";
import { GitHubReleasesFixture } from "../../fixtures/github-releases.fixture.js";
import { InstalledAppFixture } from "../../fixtures/installed-app.fixture.js";

@TestClass
export class ReleasePublishTests {
  private static readonly VERSION: string = "1.2.3-internal.7";
  private static readonly DATE: string = "2026-11-05T00:00:00.000Z";
  private static readonly TARGETS: readonly PackageTarget[] = [new PackageTarget("linux", "x64"), new PackageTarget("windows", "x64"), new PackageTarget("macos", "x64")];
  private static readonly SIGNED: readonly string[] = ["windows", "macos", "linux"];
  private static readonly FEED: string = "http://127.0.0.1:47325/";
  private static readonly REPORTS_CHECKED: string = "Every target of the release has one package report, and the signed ones were signed and checked: windows, macos, linux.\n";

  @TestMethod
  public async checksTheReleaseFilesOfAnInternalVersionAndPublishesNothingAsync(): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync();

    const result = await app.runAsync("linux", ["release-publish"], ReleasePublishTests.environment(app, ReleasePublishTests.VERSION));

    Assert.areEqual(`0 ${ReleasePublishTests.REPORTS_CHECKED}`
      + `The release files of ${ReleasePublishTests.VERSION} are checked for the internal update feed, so this run publishes nothing here.\n`, result);
  }

  @TestMethod
  @TestData("1.2.3")
  @TestData("1.2.3-beta.7")
  @TestData("1.2.3-internal.07")
  @TestData("1.2.4-internal.7")
  @TestData("1.2.2-internal.7")
  public async refusesAnInternalVersionThatIsNotOneOrLeadsToAnotherReleaseAsync(version: string): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync();

    const result = await app.runAsync("linux", ["release-publish"], ReleasePublishTests.environment(app, version));

    Assert.areEqual(`1 RELEASE_INTERNAL_VERSION must be 1.2.3-internal.<run number>, an internal build before the release, not "${version}".\n`, result);
  }

  @TestMethod
  public async refusesAnInternalVersionFromARepositoryThatDoesNotSignAsync(): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync();

    const result = await app.runAsync("linux", ["release-publish"], { ...ReleasePublishTests.environment(app, ReleasePublishTests.VERSION), RELEASE_REPOSITORY: "example/sample-app-test" });

    Assert.areEqual("1 example/sample-app-test is not the app's release repository, so its packages are unsigned and cannot go to the internal update feed.\n", result);
  }

  @TestMethod
  public async refusesInternalReleaseFilesNamedForAnotherVersionAsync(): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync("1.2.3-internal.6");

    const result = await app.runAsync("linux", ["release-publish"], ReleasePublishTests.environment(app, ReleasePublishTests.VERSION));
    const [missing = String.empty, unexpected = String.empty] = result.split(" Not part of a release: ");

    Assert.isTrue(missing.startsWith(`1 ${ReleasePublishTests.REPORTS_CHECKED}The release's files in ${path.join(app.path, "release")} differ from the files a release has. Missing: `), result);
    Assert.isTrue(missing.includes("Sample App-1.2.3-internal.7-linux-x64.AppImage") && !missing.includes("internal.6"), result);
    Assert.isTrue(unexpected.includes("Sample App-1.2.3-internal.6-windows-x64.exe") && !unexpected.includes("internal.7"), result);
    Assert.isFalse(result.includes("latest-windows-x64.yml"), result);
  }

  @TestMethod
  public async publishesNothingInARunThatTestsUpdatingAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const environment: NodeJS.ProcessEnv = {
      RELEASE_REPOSITORY: "example/sample-app",
      RELEASE_VERSION: "1.2.3",
      RELEASE_REVISION: "0123456789abcdef0123456789abcdef01234567",
      RELEASE_FOLDER: path.join(tmpdir(), "missing-release"),
      RELEASE_REPORTS: path.join(tmpdir(), "missing-reports"),
      RELEASE_RUN_URL: "https://github.com/example/sample-app/actions/runs/1"
    };

    const release = await app.runAsync("linux", ["release-publish"], environment);
    const test = await app.runAsync("linux", ["release-publish"], { ...environment, RELEASE_UPDATE_FEED: ReleasePublishTests.FEED });

    Assert.isTrue(release.startsWith("1 "), release);
    Assert.areEqual(`0 This run tests updating with the feed ${ReleasePublishTests.FEED}, so it publishes nothing.\n`, test);
  }

  @TestMethod
  public async publishesTheCheckedFilesAsTheReleaseAsync(): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync("1.2.3");
    const github = new GitHubReleasesFixture();
    const environment = { ...ReleasePublishTests.environment(app, String.empty), RELEASE_INTERNAL_VERSION: undefined };

    const result = await ReleasePublishTests.runAsync(app.path, github, environment);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(result.output.startsWith(`${ReleasePublishTests.REPORTS_CHECKED}Creating the draft release v1.2.3 for `), result.output);
    Assert.isTrue(result.output.endsWith(`with ${new ReleaseFileSet("Sample App", "1.2.3", ReleasePublishTests.TARGETS).listAll().length} files.\n`), result.output);
    Assert.isTrue(github.requests.some(t => t.includes("--raw-field body=") && t.includes("https://github.com/example/sample-app/actions/runs/1")), github.requests.join("\n"));
  }

  @TestMethod
  public async reportsAFailureOfGitHubOrOfItsProgramAsync(): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync("1.2.3");
    const environment = { ...ReleasePublishTests.environment(app, String.empty), RELEASE_INTERNAL_VERSION: String.empty };
    const failing = new GitHubReleasesFixture();
    failing.intercept = () => GitHubReleasesFixture.fail(500);
    const stuck = new GitHubReleasesFixture();
    stuck.intercept = () => {
      throw new ProcessTimeoutException("gh", 60000);
    };

    const failed = await ReleasePublishTests.runAsync(app.path, failing, environment);
    const timedOut = await ReleasePublishTests.runAsync(app.path, stuck, environment);

    Assert.areEqual(1, failed.exitCode);
    Assert.isTrue(failed.output.endsWith("failed with exit code 1: gh: request failed (HTTP 500)\n"), failed.output);
    Assert.areEqual(1, timedOut.exitCode);
    Assert.isTrue(timedOut.output.endsWith("\"gh\" did not finish within 60000 ms.\n"), timedOut.output);
  }

  @TestMethod
  public async refusesAFolderWithoutTheAppsProductAsync(): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync();

    const result = await ReleasePublishTests.runAsync(path.join(app.path, "missing"), new GitHubReleasesFixture(), ReleasePublishTests.environment(app, ReleasePublishTests.VERSION));

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(`${Resources.productMissing}\n`, result.output);
  }

  @TestMethod
  public async refusesFoldersThatAreNotAbsoluteOrHoldTheLabelMarkAsync(): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync();
    const base = ReleasePublishTests.environment(app, ReleasePublishTests.VERSION);
    const marked = path.join(app.path, "release#1");
    const cases: readonly (readonly [NodeJS.ProcessEnv, string])[] = [
      [{ ...base, RELEASE_FOLDER: "release" }, "RELEASE_FOLDER must be the absolute path of the folder that holds the release's files, not \"release\"."],
      [{ ...base, RELEASE_FOLDER: undefined }, "RELEASE_FOLDER must be the absolute path of the folder that holds the release's files, not \"\"."],
      [{ ...base, RELEASE_FOLDER: marked }, `RELEASE_FOLDER must not contain #, which gh release upload reads as the start of a file's label: "${marked}".`],
      [{ ...base, RELEASE_REPORTS: "reports" }, "RELEASE_REPORTS must be the absolute path of the folder that holds the targets' package reports, not \"reports\"."],
      [{ ...base, RELEASE_REPORTS: undefined }, "RELEASE_REPORTS must be the absolute path of the folder that holds the targets' package reports, not \"\"."]
    ];

    for (const [environment, message] of cases) {
      const result = await ReleasePublishTests.runAsync(app.path, new GitHubReleasesFixture(), environment);

      Assert.areEqual(1, result.exitCode, message);
      Assert.areEqual(`${message}\n`, result.output);
    }
  }

  @TestMethod
  public async refusesAReleaseWithoutTheAddressOfItsRunAsync(): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync();

    const result = await ReleasePublishTests.runAsync(app.path, new GitHubReleasesFixture(), { ...ReleasePublishTests.environment(app, ReleasePublishTests.VERSION), RELEASE_RUN_URL: undefined });

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual("RELEASE_RUN_URL must be the https address of the run that built the release, not \"\".\n", result.output);
  }

  @TestMethod
  public async throwsAFailureThatIsNotTheReleasesOwnAsync(): Promise<void> {
    await using app = await ReleasePublishTests.createAppAsync();
    const environment = { ...ReleasePublishTests.environment(app, ReleasePublishTests.VERSION), RELEASE_FOLDER: path.join(app.path, "package.json") };

    const error = await Assert.throwsAsync(() => new ReleasePublish(app.path, new GitHubReleasesFixture(), environment, new PassThrough()).runAsync([]), Error);

    Assert.isFalse(error instanceof BuildException, error.message);
  }

  @TestMethod
  public async answersAnArgumentWithItsUsageAsync(): Promise<void> {
    const output = new PassThrough();

    const exitCode = await new ReleasePublish(tmpdir(), new GitHubReleasesFixture(), {}, output, "noldova-desktop-release").runAsync(["now"]);

    Assert.areEqual(2, exitCode);
    Assert.areEqual(Resources.formatReleasePublishUsage("noldova-desktop-release"), output.read(output.readableLength)?.toString() ?? String.empty);
  }

  @TestMethod
  public async namesInTheNotesATargetWhosePackageTheRunNeverStartedAsync(): Promise<void> {
    const arm = new PackageTarget("linux", "arm64");
    const targets = [...ReleasePublishTests.TARGETS, arm];
    await using app = await ReleasePublishTests.createAppAsync("1.2.3", targets, [arm.id]);
    const github = new GitHubReleasesFixture();
    const environment = { ...ReleasePublishTests.environment(app, String.empty), RELEASE_INTERNAL_VERSION: undefined, RELEASE_TARGETS: targets.map(t => t.id).join(",") };

    const result = await ReleasePublishTests.runAsync(app.path, github, environment);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(github.requests.some(t => t.includes("--raw-field body=") && t.includes("in the run that built it, except Linux ARM64, whose packages that run built "
      + "but didn't install or start: https://github.com/example/sample-app/actions/runs/1")), github.requests.join("\n"));
  }

  @TestMethod
  public async publishesNothingWhenASourceArchiveThePackagesNameCannotBeDownloadedAsync(): Promise<void> {
    const source = new SourceArchive("https://127.0.0.1:9/sources-1/sample-source.tar", 10, "ab".repeat(32));
    await using app = await ReleasePublishTests.createAppAsync("1.2.3", ReleasePublishTests.TARGETS, [], [source]);
    const github = new GitHubReleasesFixture();
    const environment = { ...ReleasePublishTests.environment(app, String.empty), RELEASE_INTERNAL_VERSION: undefined };

    const result = await ReleasePublishTests.runAsync(app.path, github, environment);

    Assert.areEqual(1, result.exitCode, result.output);
    Assert.isTrue(result.output.startsWith(`${ReleasePublishTests.REPORTS_CHECKED}The source archive ${source.url} could not be downloaded: TypeError`), result.output);
    Assert.areEqual(0, github.requests.length, github.requests.join("\n"));
  }

  private static environment(app: InstalledAppFixture, version: string): NodeJS.ProcessEnv {
    return {
      RELEASE_REPOSITORY: "example/sample-app",
      RELEASE_VERSION: "1.2.3",
      RELEASE_REVISION: "0123456789abcdef0123456789abcdef01234567",
      RELEASE_FOLDER: path.join(app.path, "release"),
      RELEASE_REPORTS: path.join(app.path, "reports"),
      RELEASE_RUN_URL: "https://github.com/example/sample-app/actions/runs/1",
      RELEASE_TARGETS: ReleasePublishTests.TARGETS.map(t => t.id).join(","),
      RELEASE_INTERNAL_VERSION: version
    };
  }

  private static async runAsync(root: string, github: GitHubReleasesFixture, environment: NodeJS.ProcessEnv): Promise<{ readonly exitCode: number; readonly output: string }> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    const exitCode = await new ReleasePublish(root, github, environment, output).runAsync([]);
    return { exitCode, output: chunks.join(String.empty) };
  }

  private static async createAppAsync(written: string = ReleasePublishTests.VERSION, targets: readonly PackageTarget[] = ReleasePublishTests.TARGETS,
    unstarted: readonly string[] = [], sources: readonly SourceArchive[] = []): Promise<InstalledAppFixture> {
    const app = await InstalledAppFixture.createAsync();
    const manifest = await readFile(path.join(app.path, "package.json"), "utf8");
    await app.writeAppFileAsync("package.json", manifest.replace("\"desktop\":{", `"desktop":{"signedPlatforms":${JSON.stringify(ReleasePublishTests.SIGNED)},`));
    const set = new ReleaseFileSet("Sample App", written, targets);
    for (const target of targets) {
      for (const name of target.listFileNames("Sample App", written))
        await app.writeAppFileAsync(`release/${name}`, `${name} bytes`);
      await set.writeAsync(path.join(app.path, "release"), target, ReleasePublishTests.DATE, () => null);
      const isSigned = ReleasePublishTests.SIGNED.includes(target.platform);
      await new PackageReport(target.id, isSigned, isSigned, !unstarted.includes(target.id), sources).writeAsync(await app.writeAppFileAsync(`reports/${target.id}/${Resources.packageReportFile}`, String.empty));
    }
    return app;
  }
}
