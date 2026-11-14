/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ReleaseVersion } from "../../../src/models/release/release-version.js";
import { ReleaseNotes } from "../../../src/services/release/release-notes.js";

@TestClass
export class ReleaseNotesTests {
  private static readonly RUN: string = "https://github.com/example/sample-app/actions/runs/1";
  private static readonly REPOSITORY: string = "example/sample-app";
  private static readonly LINUX: PackageTarget = new PackageTarget("linux", "x64");
  private static readonly MACOS_ARM64: PackageTarget = new PackageTarget("macos", "arm64");

  @TestMethod
  public namesTheTargetsTheReleaseBuiltAndNoOthers(): void {
    const notes = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX, ReleaseNotesTests.MACOS_ARM64], []);

    Assert.areEqual(
      [
        "Sample App 0.0.2 for Linux x64 and macOS ARM64. Its packages are unsigned.",
        "No target has passed its native acceptance yet, so every target was accepted by a CI run only.",
        `Each target's package passed its install check on that target's own runner in the run that built it: ${ReleaseNotesTests.RUN}`
      ].join("\n\n"),
      notes);
  }

  @TestMethod
  public namesNoArm64TargetForAReleaseWithoutThem(): void {
    const notes = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX, new PackageTarget("windows", "x64"), new PackageTarget("macos", "x64")], []);

    Assert.isTrue(notes.startsWith("Sample App 0.0.2 for Linux x64, Windows x64 and macOS x64. "), notes);
    Assert.isFalse(notes.includes("ARM64"), notes);
  }

  @TestMethod
  public splitsTheBuiltTargetsIntoSupportedAndCiOnly(): void {
    const notes = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX, ReleaseNotesTests.MACOS_ARM64], [ReleaseNotesTests.LINUX]);

    Assert.isTrue(notes.includes("Supported after their native acceptance: Linux x64. Accepted by a CI run only: macOS ARM64."), notes);
  }

  @TestMethod
  public leavesOutTheCiOnlySentenceWhenEveryBuiltTargetIsSupported(): void {
    const notes = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [ReleaseNotesTests.LINUX]);

    Assert.isTrue(notes.includes("Supported after their native acceptance: Linux x64.\n\n"), notes);
    Assert.isFalse(notes.includes("Accepted by a CI run only"), notes);
  }

  @TestMethod
  public saysWhetherEveryPlatformsPackagesAreSignedOrWhichAre(): void {
    const all = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], ["windows", "macos", "linux"]);
    const some = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], ["macos"]);

    Assert.isTrue(all.startsWith("Sample App 0.0.2 for Linux x64. Its packages are signed.\n\n"), all);
    Assert.isTrue(some.startsWith("Sample App 0.0.2 for Linux x64. The macOS packages are signed; the Windows and Linux packages are unsigned.\n\n"), some);
  }

  @TestMethod
  public opensATestReleaseInAnotherRepositoryWithItsWarning(): void {
    const notes = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], [], "someone/sample-fork");

    Assert.isTrue(notes.startsWith("Unsigned test release of Sample App, published in someone/sample-fork; an installed Sample App never updates from it.\n\nSample App 0.0.2 "), notes);
    Assert.isFalse(ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], [], "Example/Sample-App").startsWith("Unsigned test release"));
  }

  @TestMethod
  public refusesARunAddressThatIsNotHttps(): void {
    for (const run of ["http://github.com/example/sample-app/actions/runs/1", "runs/1"]) {
      const error = Assert.throws(() => ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], [], ReleaseNotesTests.REPOSITORY, run), BuildException);

      Assert.areEqual(`RELEASE_RUN_URL must be the https address of the run that built the release, not "${run}".`, error.message);
    }
  }

  private static compose(targets: readonly PackageTarget[], supported: readonly PackageTarget[], signed: readonly string[] = [], repository: string = ReleaseNotesTests.REPOSITORY,
    run: string = ReleaseNotesTests.RUN): string {
    const product = ProductIdentity.fromManifest(JsonReader.fromValue({
      desktop: {
        product: {
          name: "Sample App",
          publisher: "Sample",
          slug: "sample-app",
          applicationId: "com.example.sample",
          developmentApplicationId: "com.example.sample.development",
          dataFolder: ".sample/app",
          deviceFolders: { windows: "Sample/App", macos: "Sample/App", linux: "sample/app" },
          dataDirectoryVariable: "SAMPLE_APP_DATA_DIR",
          icons: "assets/icons",
          releaseRepository: "example/sample-app"
        }
      }
    }));
    return ReleaseNotes.compose(product, targets, supported, signed, repository, ReleaseVersion.parse("0.0.2", "version"), run);
  }
}
