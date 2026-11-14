/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildMatrix } from "../../../src/models/workflows/build-matrix.js";
import { BuildTarget } from "../../../src/models/workflows/build-target.js";

@TestClass
export class BuildMatrixTests {
  @TestMethod
  public listsEachPlatformOnX64AndArm64AndPackagesOnlyLinuxAndWindowsX64EachNight(): void {
    const rows = BuildMatrix.TARGETS.map(t => `${t.platform}/${t.architecture}/${String(t.packagesEachNight)}`);

    Assert.areEqual("linux/x64/true,linux/arm64/false,windows/x64/true,windows/arm64/false,macos/x64/false,macos/arm64/false", rows.join());
    Assert.areEqual(BuildMatrix.TARGETS.length, new Set(BuildMatrix.TARGETS.map(t => t.runnerName)).size);
  }

  @TestMethod
  public takesTheTargetsPlatformFromTheFirstWordOfItsName(): void {
    const target = new BuildTarget("macOS ARM64", "RUNS_ON_MACOS_ARM64", "arm64", false);

    Assert.areEqual("macos", target.platform);
    Assert.areEqual("macOS ARM64|RUNS_ON_MACOS_ARM64|arm64|false", [target.name, target.runnerName, target.architecture, String(target.packagesEachNight)].join("|"));
  }
}
