/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageNaming } from "../../../src/services/packages/package-naming.js";

@TestClass
export class PackageNamingTests {
  @TestMethod
  @TestData("@noldova/context.core")
  @TestData("@noldova/context.json")
  @TestData("@noldova/desktop.protocol")
  @TestData("@noldova/ui.components.angular")
  public countsAPackageOfEitherOfTheCompanysScopesAsTheCompanysOwn(name: string): void {
    Assert.isTrue(PackageNaming.isNoldova(name));
  }

  @TestMethod
  @TestData("@noldova/context.core")
  @TestData("@noldova/context.exceptions")
  @TestData("@noldova/context.json")
  public sharesContextsPublicPackagesWithEveryPartAsOneCopy(name: string): void {
    Assert.isTrue(PackageNaming.isShared(name));
    Assert.isTrue(PackageNaming.isContext(name));
  }

  @TestMethod
  @TestData("@noldova/desktop.build")
  @TestData("@noldova/desktop.cli")
  @TestData("@noldova/desktop.electron")
  @TestData("@noldova/desktop.protocol")
  @TestData("@noldova/desktop.runtime")
  @TestData("@noldova/desktop.window")
  public sharesEachPackageNoldovaDesktopPublishesWithEveryPartAsOneCopy(name: string): void {
    Assert.isTrue(PackageNaming.isShared(name));
    Assert.isFalse(PackageNaming.isContext(name));
  }

  @TestMethod
  @TestData("@noldova/desktop.clock")
  @TestData("@noldova/desktop.clock.runtime")
  @TestData("@noldova/desktop.fixture.clock.window")
  @TestData("@noldova/desktop.protocol.extras")
  public leavesAModulesPackageNamedInTheDesktopScopeOutOfTheSharedOnes(name: string): void {
    Assert.isFalse(PackageNaming.isShared(name));
    Assert.isTrue(PackageNaming.isOwn(name));
  }

  @TestMethod
  public namesFixturePackagesAndModulePackagesFromTheSameTable(): void {
    Assert.areEqual("@noldova/desktop.fixture.clock.runtime", PackageNaming.nameFixturePackage("clock/runtime"));
    Assert.areEqual("@noldova/desktop.notes.window", PackageNaming.nameModulePackage("notes", "window", false));
    Assert.areEqual("@noldova/desktop.fixture.clock.cli", PackageNaming.nameModulePackage("clock", "cli", true));
    Assert.areEqual("@noldova/desktop.notes.", PackageNaming.locateModulePrefix("notes", false));
  }

  @TestMethod
  public namesAModulesWindowPartPackageWithItsNameAndWindowJoinedByADot(): void {
    Assert.areEqual("@example/notes.window", PackageNaming.nameWindowPackage("@example/notes"));
    Assert.areEqual("@noldova/desktop.fixture.packages.beacon.window", PackageNaming.nameWindowPackage("@noldova/desktop.fixture.packages.beacon"));
  }

  @TestMethod
  public countsAPackageOfTheCompanysOtherScopeAsTheCompanys(): void {
    Assert.isTrue(PackageNaming.isNoldova("@noldova-com/sample"));
  }

  @TestMethod
  @TestData("@example/app.", "@example/app.clock.runtime")
  @TestData("@example/", "@example/clock.runtime")
  @TestData("@noldova-com/desktop-", "@noldova-com/desktop-clock-runtime")
  public namesAModulePartFromTheAppsPrefix(prefix: string, expected: string): void {
    Assert.areEqual(expected, PackageNaming.nameModulePackage("clock", "runtime", false, prefix));
    Assert.areEqual(expected, PackageNaming.nameSourcePackage("src/modules/clock/runtime", prefix));
    Assert.isTrue(PackageNaming.isOwn(expected, prefix));
  }

  @TestMethod
  public keepsAFixturesNameWhateverTheAppsPrefix(): void {
    Assert.areEqual("@noldova/desktop.fixture.clock.cli", PackageNaming.nameModulePackage("clock", "cli", true, "@example/app."));
  }

  @TestMethod
  public leavesAModulePackageOfAnotherPrefixOutOfTheOwnOnes(): void {
    Assert.isFalse(PackageNaming.isOwn("@example/app.clock.runtime"));
  }

  @TestMethod
  @TestData("@noldova/desktop.", "@noldova")
  @TestData("@example/app.", "@noldova,@example")
  public listsTheScopesAnAppsOwnPackagesLiveIn(prefix: string, expected: string): void {
    Assert.areEqual(expected, PackageNaming.listOwnScopes(prefix).join(","));
  }

  @TestMethod
  @TestData("src/noldova.desktop.protocol", "@noldova/desktop.protocol")
  @TestData("src/Noldova.Desktop.Protocol", "@noldova-com/desktop-protocol")
  @TestData("src/noldova.desktop", "@noldova/desktop")
  @TestData("src/Noldova.Desktop", "@noldova-com/desktop")
  public namesAPackageFromALowerCaseOrTitleCaseFolder(directory: string, expected: string): void {
    Assert.areEqual(expected, PackageNaming.nameSourcePackage(directory));
  }

  @TestMethod
  @TestData("src/noldova.other.protocol")
  @TestData("src/Noldova.Other.Protocol")
  @TestData("src/noldova.Desktop.Protocol")
  @TestData("src/noldova.desktop.protocol/nested")
  @TestData("lib/noldova.desktop.protocol")
  public refusesAFolderOfNeitherForm(directory: string): void {
    Assert.throws(() => PackageNaming.nameSourcePackage(directory), BuildException);
  }

  @TestMethod
  @TestData("src/noldova.desktop.protocol/package.json", "src/noldova.desktop.protocol")
  @TestData("src/Noldova.Desktop.Protocol/src/index.ts", "src/Noldova.Desktop.Protocol")
  public locatesThePackageFolderAFileIsIn(file: string, expected: string): void {
    Assert.areEqual(expected, PackageNaming.locatePackageFolder(file));
  }

  @TestMethod
  @TestData("src/noldova.desktop.protocol")
  @TestData("src/noldova.other.protocol/package.json")
  @TestData("lib/noldova.desktop.protocol/package.json")
  public locatesNoPackageFolderForAFolderItselfOrAFileOutsideAPackage(file: string): void {
    Assert.isNull(PackageNaming.locatePackageFolder(file));
  }
}
