/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageReport } from "../../../src/models/packaging/package-report.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ReleaseReports } from "../../../src/services/release/release-reports.js";
import { Resources } from "../../../src/resources.js";
import { ReportEntryFixture } from "../../fixtures/report-entry.fixture.js";
import { SigningCaseFixture } from "../../fixtures/signing-case.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class ReleaseReportsTests {
  private static readonly X64: readonly PackageTarget[] = [new PackageTarget("linux", "x64"), new PackageTarget("windows", "x64"), new PackageTarget("macos", "x64")];
  private static readonly LINUX: readonly PackageTarget[] = [new PackageTarget("linux", "x64")];

  @TestMethod
  public async acceptsOneReportForEachTargetOfAReleaseWithoutArm64Async(): Promise<void> {
    await using folder = await ReleaseReportsTests.createFolderAsync(ReleaseReportsTests.X64.map(t => t.id));

    const verified = await new ReleaseReports([], ReleaseReportsTests.X64).verifyAsync(folder.path);

    Assert.areEqual("Every target of the release has one package report, and the signed ones were signed and checked: none.", verified.text);
  }

  @TestMethod
  public async acceptsSignedAndCheckedReportsForTheSignedPlatformsAsync(): Promise<void> {
    const targets = [new PackageTarget("windows", "x64"), new PackageTarget("linux", "x64")];
    await using folder = await ReleaseReportsTests.createEntriesAsync([
      new ReportEntryFixture("windows-x64", new PackageReport("windows-x64", true, true)),
      new ReportEntryFixture("linux-x64", new PackageReport("linux-x64", false, false))
    ]);

    const verified = await new ReleaseReports(["windows"], targets).verifyAsync(folder.path);

    Assert.areEqual("Every target of the release has one package report, and the signed ones were signed and checked: windows.", verified.text);
  }

  @TestMethod
  public async namesTheTargetsWhosePackagesNeverStartedAsync(): Promise<void> {
    const targets = [new PackageTarget("linux", "x64"), new PackageTarget("linux", "arm64"), new PackageTarget("macos", "arm64")];
    await using folder = await ReleaseReportsTests.createEntriesAsync([
      new ReportEntryFixture("linux-x64", new PackageReport("linux-x64", false, false, true)),
      new ReportEntryFixture("linux-arm64", new PackageReport("linux-arm64", false, false)),
      new ReportEntryFixture("macos-arm64", new PackageReport("macos-arm64", false, false, true))
    ]);

    const verified = await new ReleaseReports([], targets).verifyAsync(folder.path);

    Assert.areEqual("linux-arm64", verified.unstarted.map(t => t.id).join());
  }

  @TestMethod
  public async listsEachSourcePageTheReportsNameOnceAsync(): Promise<void> {
    const targets = [new PackageTarget("linux", "x64"), new PackageTarget("windows", "x64"), new PackageTarget("macos", "arm64")];
    const git = "https://example.com/git/tree/v1.0.0";
    const windows = "https://example.com/git-for-windows/releases/tag/v1.0.0.windows.1";
    const native = "https://example.com/native/tree/0123456";
    await using folder = await ReleaseReportsTests.createEntriesAsync([
      new ReportEntryFixture("linux-x64", new PackageReport("linux-x64", false, false, true, [git, native])),
      new ReportEntryFixture("windows-x64", new PackageReport("windows-x64", false, false, true, [windows])),
      new ReportEntryFixture("macos-arm64", new PackageReport("macos-arm64", false, false, true, [git, native]))
    ]);

    const verified = await new ReleaseReports([], targets).verifyAsync(folder.path);

    Assert.areEqual(JSON.stringify([git, native, windows]), JSON.stringify(verified.sourcePages));
  }

  @TestMethod
  public async refusesNoReportForATargetTheReleaseNamesAsync(): Promise<void> {
    const targets = [...ReleaseReportsTests.X64, new PackageTarget("macos", "arm64")];
    await using folder = await ReleaseReportsTests.createFolderAsync(ReleaseReportsTests.X64.map(t => t.id));

    const error = await Assert.throwsAsync(() => new ReleaseReports([], targets).verifyAsync(folder.path), BuildException);

    Assert.isTrue(error.message.includes("No package report covers macos-arm64."), error.message);
  }

  @TestMethod
  public async refusesAReportForATargetTheReleaseDoesNotNameAsync(): Promise<void> {
    await using folder = await ReleaseReportsTests.createFolderAsync([...ReleaseReportsTests.X64.map(t => t.id), "macos-arm64"]);

    const error = await Assert.throwsAsync(() => new ReleaseReports([], ReleaseReportsTests.X64).verifyAsync(folder.path), BuildException);

    Assert.isTrue(error.message.includes("A package report covers macos-arm64, which is not a target of this release."), error.message);
  }

  @TestMethod
  public async refusesTwoReportsForOneTargetAsync(): Promise<void> {
    await using folder = await ReleaseReportsTests.createEntriesAsync([
      new ReportEntryFixture("first", new PackageReport("linux-x64", false, false)),
      new ReportEntryFixture("second", new PackageReport("linux-x64", false, false))
    ]);

    const error = await Assert.throwsAsync(() => new ReleaseReports([], ReleaseReportsTests.LINUX).verifyAsync(folder.path), BuildException);

    Assert.areEqual("The package reports do not match the release's signing, so nothing was published:\n2 package reports cover linux-x64.", error.message);
  }

  @TestMethod
  public async describesEachReportWhoseSigningDiffersFromTheReleasesAsync(): Promise<void> {
    const cases: readonly SigningCaseFixture[] = [
      new SigningCaseFixture(new PackageReport("linux-x64", true, true), [], "The linux-x64 package was signed and checked, but the release does not sign linux packages."),
      new SigningCaseFixture(new PackageReport("linux-x64", true, false), ["linux"], "The linux-x64 package was signed but not checked, but the release signs linux packages."),
      new SigningCaseFixture(new PackageReport("linux-x64", false, true), [], "The linux-x64 package was unsigned but marked checked, but the release does not sign linux packages."),
      new SigningCaseFixture(new PackageReport("linux-x64", false, false), ["linux"], "The linux-x64 package was unsigned, but the release signs linux packages.")
    ];
    for (const { report, signed, problem } of cases) {
      await using folder = await ReleaseReportsTests.createEntriesAsync([new ReportEntryFixture("linux-x64", report)]);

      const error = await Assert.throwsAsync(() => new ReleaseReports(signed, ReleaseReportsTests.LINUX).verifyAsync(folder.path), BuildException);

      Assert.isTrue(error.message.endsWith(`\n${problem}`), error.message);
    }
  }

  @TestMethod
  public async namesAnEntryThatHoldsNoReadableReportAsync(): Promise<void> {
    await using folder = await ReleaseReportsTests.createEntriesAsync([
      new ReportEntryFixture("b-empty", null),
      new ReportEntryFixture("c-broken", "{"),
      new ReportEntryFixture("d-shape", JSON.stringify({ target: "linux-x64" })),
      new ReportEntryFixture("linux-x64", new PackageReport("linux-x64", false, false))
    ]);
    await writeFile(path.join(folder.path, "a-file"), "not a folder");
    await mkdir(path.join(folder.path, "e-folder", Resources.packageReportFile), { recursive: true });

    const error = await Assert.throwsAsync(() => new ReleaseReports([], ReleaseReportsTests.LINUX).verifyAsync(folder.path), BuildException);

    Assert.areEqual([
      "The package reports do not match the release's signing, so nothing was published:",
      "a-file holds no package report.",
      "b-empty holds no package report.",
      "c-broken holds no package report.",
      "d-shape holds no package report.",
      "e-folder's package report cannot be read."
    ].join("\n"), error.message);
  }

  @TestMethod
  public async readsTheEntriesInCodePointOrderAsync(): Promise<void> {
    await using folder = await ReleaseReportsTests.createEntriesAsync([new ReportEntryFixture("a-empty", null), new ReportEntryFixture("B-empty", null), new ReportEntryFixture("linux-x64", new PackageReport("linux-x64", false, false))]);

    const error = await Assert.throwsAsync(() => new ReleaseReports([], ReleaseReportsTests.LINUX).verifyAsync(folder.path), BuildException);

    Assert.areEqual([
      "The package reports do not match the release's signing, so nothing was published:",
      "B-empty holds no package report.",
      "a-empty holds no package report."
    ].join("\n"), error.message);
  }

  @TestMethod
  public async refusesAFolderItCannotReadWithItsCauseAsync(): Promise<void> {
    const missing = path.join(tmpdir(), "desktop-release-reports-missing", "reports");

    const error = await Assert.throwsAsync(() => new ReleaseReports([], ReleaseReportsTests.LINUX).verifyAsync(missing), BuildException);

    Assert.areEqual(`The package reports in ${missing} cannot be read.`, error.message);
    Assert.isInstanceOf(error.cause, Error);
  }

  private static createFolderAsync(ids: readonly string[]): Promise<SourceTreeFixture> {
    return ReleaseReportsTests.createEntriesAsync(ids.map(t => new ReportEntryFixture(t, new PackageReport(t, false, false))));
  }

  private static async createEntriesAsync(entries: readonly ReportEntryFixture[]): Promise<SourceTreeFixture> {
    const folder = await SourceTreeFixture.createAsync();
    for (const { id, report } of entries) {
      await mkdir(path.join(folder.path, id));
      const file = path.join(folder.path, id, Resources.packageReportFile);
      if (report instanceof PackageReport)
        await report.writeAsync(file);
      else if (Object.isString(report))
        await writeFile(file, report);
    }
    return folder;
  }
}
