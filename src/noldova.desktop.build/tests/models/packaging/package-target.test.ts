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

@TestClass
export class PackageTargetTests {
  @TestMethod
  public describesTheFormatsAndNamesOfEachPlatform(): void {
    const windows = new PackageTarget("windows", "x64");
    const macos = new PackageTarget("macos", "arm64");
    const linux = new PackageTarget("linux", "x64");

    Assert.areEqual("windows-x64 win32-x64 nsis exe exe", `${windows.id} ${windows.addonTarget} ${windows.formats.join(",")} ${windows.extensions.join(",")} ${windows.updateExtension}`);
    Assert.areEqual("macos-arm64 darwin-arm64 dmg,zip dmg,zip zip", `${macos.id} ${macos.addonTarget} ${macos.formats.join(",")} ${macos.extensions.join(",")} ${macos.updateExtension}`);
    Assert.areEqual("linux-x64 linux-x64 AppImage,deb AppImage,deb AppImage", `${linux.id} ${linux.addonTarget} ${linux.formats.join(",")} ${linux.extensions.join(",")} ${linux.updateExtension}`);
  }

  @TestMethod
  public namesThePackageFilesOfAProduct(): void {
    const macos = new PackageTarget("macos", "x64");

    Assert.areEqual("Sample App-1.2.3-macos-x64.zip", macos.formatFileName("Sample App", "1.2.3", "zip"));
    Assert.areEqual("Sample App-1.2.3-macos-x64.dmg|Sample App-1.2.3-macos-x64.zip", macos.listFileNames("Sample App", "1.2.3").join("|"));
  }

  @TestMethod
  public mapsTheProcessPlatformAndKeepsAnUnknownOne(): void {
    Assert.areEqual("windows-arm64", PackageTarget.fromProcess("win32", "arm64").id);
    Assert.areEqual("linux-x64", PackageTarget.fromProcess("linux", "x64").id);
    Assert.areEqual("macos-x64", PackageTarget.fromProcess("macos", "x64").id);
  }

  @TestMethod
  public listsEveryPlatformOnEveryArchitecture(): void {
    Assert.areEqual("windows-x64,windows-arm64,macos-x64,macos-arm64,linux-x64,linux-arm64", PackageTarget.listAll().map(t => t.id).join(","));
  }

  @TestMethod
  public refusesAnUnsupportedPlatformOrArchitecture(): void {
    const platform = Assert.throws(() => PackageTarget.fromProcess("freebsd", "x64"), BuildException);
    const architecture = Assert.throws(() => new PackageTarget("linux", "ia32"), BuildException);

    Assert.areEqual("Packages are made for windows, macos and linux on x64 and arm64, not for freebsd on x64.", platform.message);
    Assert.areEqual("Packages are made for windows, macos and linux on x64 and arm64, not for linux on ia32.", architecture.message);
  }

  @TestMethod
  public buildsForTheArchitectureTheEnvironmentNamesAndOtherwiseForTheProcesssOwn(): void {
    Assert.areEqual("arm64", PackageTarget.readArchitecture({ NOLDOVA_DESKTOP_ARCHITECTURE: "arm64" }, "x64"));
    Assert.areEqual("x64", PackageTarget.readArchitecture({ NOLDOVA_DESKTOP_ARCHITECTURE: "" }, "x64"));
    Assert.areEqual("arm64", PackageTarget.readArchitecture({}, "arm64"));
  }
}
