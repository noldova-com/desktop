/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ReleaseRequest } from "../../../src/models/release/release-request.js";
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
  public namesOnlyTheCiOnlyTargetsWhenSomeBuiltTargetsAreSupported(): void {
    const notes = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX, ReleaseNotesTests.MACOS_ARM64], [ReleaseNotesTests.LINUX]);

    Assert.areEqual(
      [
        "Sample App 0.0.2 for Linux x64 and macOS ARM64. Its packages are unsigned.",
        "Accepted by a CI run only: macOS ARM64.",
        `Each target's package passed its install check on that target's own runner in the run that built it: ${ReleaseNotesTests.RUN}`
      ].join("\n\n"),
      notes);
  }

  @TestMethod
  public writesNoAcceptanceParagraphWhenEveryBuiltTargetIsSupported(): void {
    const notes = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [ReleaseNotesTests.LINUX]);

    Assert.areEqual(
      [
        "Sample App 0.0.2 for Linux x64. Its packages are unsigned.",
        `Each target's package passed its install check on that target's own runner in the run that built it: ${ReleaseNotesTests.RUN}`
      ].join("\n\n"),
      notes);
    Assert.isFalse(notes.includes("Supported after their native acceptance"), notes);
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
  public namesTheSourceCommitOfAReleaseInAnotherRepository(): void {
    const notes = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], [], "example/downloads", ReleaseNotesTests.RUN, "example/sample-app", "example/downloads");

    Assert.isTrue(notes.startsWith("Sample App 0.0.2 "), notes);
    Assert.isTrue(notes.endsWith(`${ReleaseNotesTests.RUN}\n\nBuilt from example/sample-app at 0123456789abcdef0123456789abcdef01234567.`), notes);
    Assert.isFalse(ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], []).includes("Built from"));
  }

  @TestMethod
  public leavesOutTheRunOfABuildInARepositoryThatIsNeitherTheSourceNorTheRelease(): void {
    const notes = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], [], "example/downloads", "https://github.com/example/builds/actions/runs/7", "example/sample-app", "example/downloads", "example/builds");
    const inRelease = ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], [], "example/downloads", ReleaseNotesTests.RUN, "example/sample-app", "example/downloads", "example/downloads");

    Assert.isFalse(notes.includes("example/builds"), notes);
    Assert.isFalse(notes.includes("install check"), notes);
    Assert.isTrue(notes.endsWith("accepted by a CI run only.\n\nBuilt from example/sample-app at 0123456789abcdef0123456789abcdef01234567."), notes);
    Assert.isTrue(inRelease.includes(ReleaseNotesTests.RUN), inRelease);
  }

  @TestMethod
  public refusesARunAddressThatIsNotHttps(): void {
    for (const run of ["http://github.com/example/sample-app/actions/runs/1", "runs/1"]) {
      const error = Assert.throws(() => ReleaseNotesTests.compose([ReleaseNotesTests.LINUX], [], [], ReleaseNotesTests.REPOSITORY, run), BuildException);

      Assert.areEqual(`RELEASE_RUN_URL must be the https address of the run that built the release, not "${run}".`, error.message);
    }
  }

  private static compose(targets: readonly PackageTarget[], supported: readonly PackageTarget[], signed: readonly string[] = [], repository: string = ReleaseNotesTests.REPOSITORY,
    run: string = ReleaseNotesTests.RUN, source: string = repository, releaseRepository: string = "example/sample-app", build: string = source): string {
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
          releaseRepository
        }
      }
    }));
    const request = ReleaseRequest.read({ RELEASE_REPOSITORY: repository, RELEASE_SOURCE_REPOSITORY: source, RELEASE_BUILD_REPOSITORY: build, RELEASE_TAG_PREFIX: repository === source ? String.empty : "sample-app-", RELEASE_VERSION: "0.0.2", RELEASE_REVISION: "0123456789abcdef0123456789abcdef01234567" });
    return ReleaseNotes.compose(product, targets, supported, signed, request, run);
  }
}
