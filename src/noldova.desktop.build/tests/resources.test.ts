/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { Resources } from "../src/resources.js";

@TestClass
export class ResourcesTests {
  @TestMethod
  public namesTheCompanyPackagesInTheStageOrNone(): void {
    Assert.areEqual("The company's packages in the stage: @noldova/context.core@0.0.7, @noldova/context.json@0.0.7.\n", Resources.formatStageCompanyPackages(["@noldova/context.core@0.0.7", "@noldova/context.json@0.0.7"]));
    Assert.areEqual("The company's packages in the stage: none.\n", Resources.formatStageCompanyPackages([]));
  }

  @TestMethod
  public namesEveryPartTheStageMisses(): void {
    Assert.areEqual(
      "The stage needs @noldova/desktop.clock.runtime, @noldova/desktop.clock.window, which is not a package under src/.",
      Resources.formatStagePartsMissing(["@noldova/desktop.clock.runtime", "@noldova/desktop.clock.window"]));
  }

  @TestMethod
  public describesTheActiveModulesAndEachKindLeftOutInTheNumberItTakes(): void {
    Assert.areEqual("The installed app's modules are active: none.", Resources.formatPackagedModulesActive([], [], [], [], "linux"));
    Assert.areEqual(
      "The installed app's modules are active: notes; clock unavailable on linux, which it leaves out; maps blocked by a dependency linux leaves out; beacon off by its switch setting.",
      Resources.formatPackagedModulesActive(["notes"], ["clock"], ["maps"], ["beacon"], "linux"));
    Assert.areEqual(
      "The installed app's modules are active: notes, chats; clock, timer unavailable on macos, which they leave out; beacon, radar off by their switch setting.",
      Resources.formatPackagedModulesActive(["notes", "chats"], ["clock", "timer"], [], ["beacon", "radar"], "macos"));
  }

  @TestMethod
  public namesTheFilesAReleaseMissesAndTheOnesItShouldNotHaveOrNone(): void {
    Assert.areEqual(
      "v1.2.3 on GitHub differs from the built files. Missing: app.exe, app.dmg. Not part of the release: none.",
      Resources.formatReleaseAssetsDiffer("v1.2.3", ["app.exe", "app.dmg"], []));
    Assert.areEqual(
      "v1.2.3 on GitHub differs from the built files. Missing: none. Not part of the release: notes.txt.",
      Resources.formatReleaseAssetsDiffer("v1.2.3", [], ["notes.txt"]));
  }

  @TestMethod
  public namesAnAssetWithoutADigest(): void {
    Assert.areEqual(
      "app.exe on GitHub has 10 bytes and no digest, but the built file has 12 bytes and sha256:ab. Only a draft's file from an earlier run is ever replaced.",
      Resources.formatAssetMismatch("app.exe", 10, null, 12, "sha256:ab"));
    Assert.areEqual(
      "app.exe on GitHub has 10 bytes and sha256:cd, but the built file has 12 bytes and sha256:ab. Only a draft's file from an earlier run is ever replaced.",
      Resources.formatAssetMismatch("app.exe", 10, "sha256:cd", 12, "sha256:ab"));
  }

  @TestMethod
  public describesTheRuntimesMountOfTheAppImage(): void {
    Assert.areEqual("/tmp/.mount_app/", Resources.formatFolderPrefix("/tmp/.mount_app"));
    Assert.areEqual(
      "The runtime, process 4242, holds no mount of the AppImage through a pipe: it runs /opt/app/sample-app with the input /dev/null.",
      Resources.formatSmokeNoMount(4242, "/opt/app/sample-app", "/dev/null"));
    Assert.areEqual("The runtime runs from its own mount of the AppImage at /tmp/.mount_app and holds it through its input pipe.\n", Resources.formatSmokeMounted("/tmp/.mount_app"));
    Assert.areEqual(`The runtime, process 4242, was still running ${Resources.smokeKillLimit} ms after it was killed.`, Resources.formatSmokeRuntimeStillRunning(4242));
  }
}
