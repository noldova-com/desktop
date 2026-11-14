/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ReleaseTargets } from "../../../src/services/release/release-targets.js";

@TestClass
export class ReleaseTargetsTests {
  @TestMethod
  public readsTheTargetsTheReleaseBuiltInTheOrderOfAllTargets(): void {
    const targets = ReleaseTargets.read({ RELEASE_TARGETS: "macos-arm64,linux-x64,windows-x64,macos-x64" }, []);

    Assert.areEqual("windows-x64,macos-x64,macos-arm64,linux-x64", targets.map(t => t.id).join(","));
  }

  @TestMethod
  public readsAReleaseWithoutArm64Targets(): void {
    const targets = ReleaseTargets.read({ RELEASE_TARGETS: "linux-x64,windows-x64,macos-x64" }, []);

    Assert.areEqual(3, targets.length);
    Assert.isTrue(targets.every(t => t.architecture === "x64"));
  }

  @TestMethod
  public refusesAnEmptyOrUnsetList(): void {
    for (const environment of [{}, { RELEASE_TARGETS: String.empty }]) {
      const error = Assert.throws(() => ReleaseTargets.read(environment, []), BuildException);

      Assert.isTrue(error.message.startsWith("RELEASE_TARGETS must list the targets the release built, distinct and among "), error.message);
    }
  }

  @TestMethod
  public refusesAnUnknownOrRepeatedTarget(): void {
    for (const text of ["linux-x64,linux-riscv", "linux-x64,linux-x64", "linux-x64,", "Linux x64"]) {
      const error = Assert.throws(() => ReleaseTargets.read({ RELEASE_TARGETS: text }, []), BuildException);

      Assert.isTrue(error.message.endsWith(`separated by commas, not "${text}".`), error.message);
    }
  }

  @TestMethod
  public refusesAListWithoutEveryX64TargetWhenTheAppListsNoSupportedTargets(): void {
    const error = Assert.throws(() => ReleaseTargets.read({ RELEASE_TARGETS: "linux-x64,macos-arm64" }, null), BuildException);

    Assert.areEqual("This release builds windows-x64, macos-x64, linux-x64, but RELEASE_TARGETS leaves out windows-x64, macos-x64.", error.message);
  }

  @TestMethod
  public acceptsAListThatLeavesOutAnX64TargetTheAppDoesNotSupport(): void {
    const supported = [new PackageTarget("windows", "x64"), new PackageTarget("linux", "x64")];

    const targets = ReleaseTargets.read({ RELEASE_TARGETS: "linux-x64,windows-x64" }, supported);

    Assert.areEqual("windows-x64,linux-x64", targets.map(t => t.id).join(","));
  }

  @TestMethod
  public refusesAListWithoutLinuxOrWindowsX64EvenWhenTheAppLeavesThemOut(): void {
    for (const [text, left] of [["linux-x64", "windows-x64"], ["windows-x64", "linux-x64"]]) {
      const error = Assert.throws(() => ReleaseTargets.read({ RELEASE_TARGETS: text }, []), BuildException);

      Assert.areEqual(`This release builds windows-x64, linux-x64, but RELEASE_TARGETS leaves out ${left}.`, error.message);
    }
  }

  @TestMethod
  public refusesAListWithoutAnX64TargetTheAppSupports(): void {
    const supported = [new PackageTarget("macos", "x64")];

    const error = Assert.throws(() => ReleaseTargets.read({ RELEASE_TARGETS: "linux-x64,windows-x64" }, supported), BuildException);

    Assert.areEqual("This release builds windows-x64, macos-x64, linux-x64, but RELEASE_TARGETS leaves out macos-x64.", error.message);
  }

  @TestMethod
  public requiresOnlyX64TargetsTheAppBuilds(): void {
    const supported = [new PackageTarget("macos", "arm64")];

    Assert.isFalse(ReleaseTargets.isRequired(new PackageTarget("macos", "arm64"), supported));
    Assert.isFalse(ReleaseTargets.isRequired(new PackageTarget("linux", "arm64"), null));
    Assert.isFalse(ReleaseTargets.isRequired(new PackageTarget("macos", "x64"), supported));
    Assert.isTrue(ReleaseTargets.isRequired(new PackageTarget("macos", "x64"), null));
    Assert.isTrue(ReleaseTargets.isRequired(new PackageTarget("linux", "x64"), supported));
  }

  @TestMethod
  public refusesToCallATargetSupportedThatTheReleaseDidNotBuild(): void {
    const supported = [new PackageTarget("windows", "arm64"), new PackageTarget("linux", "x64")];

    const error = Assert.throws(() => ReleaseTargets.read({ RELEASE_TARGETS: "linux-x64,windows-x64,macos-x64" }, supported), BuildException);

    Assert.areEqual("The root package.json's desktop.supportedTargets lists windows-arm64, which this release did not build, so it cannot call them supported.", error.message);
  }

  @TestMethod
  public acceptsASupportedTargetTheReleaseBuilt(): void {
    const targets = ReleaseTargets.read({ RELEASE_TARGETS: "linux-x64,windows-x64,macos-x64,macos-arm64" }, [new PackageTarget("macos", "arm64")]);

    Assert.areEqual("windows-x64,macos-x64,macos-arm64,linux-x64", targets.map(t => t.id).join(","));
  }
}
