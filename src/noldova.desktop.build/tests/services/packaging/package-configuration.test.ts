/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { PackageConfiguration } from "../../../src/services/packaging/package-configuration.js";
import { MainPackageConfigurationsFixture } from "../../fixtures/main-package-configurations.fixture.js";

@TestClass
export class PackageConfigurationTests {
  private static readonly ROOT: string = path.resolve("sample-app");
  private static readonly APP: string = path.resolve("out", "win-unpacked");
  private static readonly UNPACKED: string = path.join(PackageConfigurationTests.APP, "resources", "app.asar.unpacked");
  private static readonly PTY: string = path.join(PackageConfigurationTests.UNPACKED, "node_modules", "node-pty", "build", "Release");
  private static readonly PRODUCT_FIELDS: Readonly<Record<string, unknown>> = {
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
  };
  private static readonly PRODUCT: ProductIdentity = ProductIdentity.fromManifest(JsonReader.fromValue({ desktop: { product: PackageConfigurationTests.PRODUCT_FIELDS } }));
  private static readonly FOLDERED: ProductIdentity = ProductIdentity.fromManifest(JsonReader.fromValue({
    desktop: { product: { ...PackageConfigurationTests.PRODUCT_FIELDS, installFolder: "Sample Makers" } }
  }));

  @TestMethod
  public unpacksEachAddonAndEachNativeFileItIsGiven(): void {
    const root = path.resolve("sample-app");
    const configuration = new PackageConfiguration(root, PackageConfigurationTests.PRODUCT, "1.2.3", new PackageTarget("linux", "x64"), path.join(root, "stage"), path.join(root, "out"),
      path.join(root, "electron"), "44.5.1", false, null, false);
    const helpers = ["node_modules/node-pty/build/Release/conpty/OpenConsole.exe", "node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper"];

    const addons = configuration.toJson([])["asarUnpack"];
    const both = configuration.toJson(helpers)["asarUnpack"];

    Assert.areEqual(JSON.stringify(["**/*.node"]), JSON.stringify(addons));
    Assert.areEqual(JSON.stringify(["**/*.node", ...helpers]), JSON.stringify(both));
  }

  @TestMethod
  public treatsEachLibraryAndEachProgramUnderTheUnpackedNodeModulesAsALibrary(): void {
    const libraries = [
      path.join(PackageConfigurationTests.PTY, "conpty.dll"),
      path.join(PackageConfigurationTests.PTY, "conpty", "OpenConsole.exe"),
      path.join(PackageConfigurationTests.APP, "ffmpeg.dll"),
      path.join("resources", "app.asar.unpacked", "node_modules", "sample", "helper.exe")
    ];

    for (const library of libraries)
      Assert.isTrue(PackageConfiguration.isLibrary(library), library);
  }

  @TestMethod
  public treatsTheAppsOwnProgramsAndAddonsAsItsOwn(): void {
    const own = [
      path.join(PackageConfigurationTests.APP, "Sample.exe"),
      path.join(PackageConfigurationTests.APP, "Uninstall Sample.exe"),
      path.join(PackageConfigurationTests.PTY, "pty.node"),
      path.join(PackageConfigurationTests.UNPACKED, "native", "helper.exe"),
      path.join(PackageConfigurationTests.APP, "resources", "node_modules", "sample", "helper.exe"),
      path.join(PackageConfigurationTests.APP, "resources", "app.asar.unpacked", "sample", "node_modules.exe")
    ];

    for (const file of own)
      Assert.isFalse(PackageConfiguration.isLibrary(file), file);
  }

  @TestMethod
  public readsALibraryOrProgramWhateverTheCaseOfItsExtension(): void {
    Assert.isTrue(PackageConfiguration.isLibrary(path.join(PackageConfigurationTests.PTY, "CONPTY.DLL")));
    Assert.isTrue(PackageConfiguration.isLibrary(path.join(PackageConfigurationTests.PTY, "conpty", "OpenConsole.EXE")));
    Assert.isFalse(PackageConfiguration.isLibrary(path.join(PackageConfigurationTests.APP, "Sample.EXE")));
    Assert.isFalse(PackageConfiguration.isLibrary(path.join(PackageConfigurationTests.PTY, "pty.NODE")));
  }

  @TestMethod
  public signsEveryProgramLibraryAndAddonOnWindowsWhateverTheCaseOfItsExtension(): void {
    const root = path.resolve("sample-app");
    const configuration = new PackageConfiguration(root, PackageConfigurationTests.PRODUCT, "1.2.3", new PackageTarget("windows", "x64"), path.join(root, "stage"),
      path.join(root, "out"), path.join(root, "electron"), "44.5.1", true, "CN=Sample, O=Sample", false);
    const windows = PackageConfigurationTests.read(configuration).readObject("win");
    const signed = windows.readStringArray("signExts");
    const files = ["helper.exe", "HELPER.EXE", "Helper.Exe", "conpty.dll", "CONPTY.DLL", "conpty.Dll", "pty.node", "PTY.NODE", "pty.NoDe"];

    for (const file of files)
      Assert.isTrue(signed.some(t => file.endsWith(t)), file);
    Assert.isFalse(signed.some(t => "sample-app.cmd".endsWith(t)));
    Assert.areEqual("CN=Sample, O=Sample", windows.readObject("signtoolOptions").readString("publisherName"));
    Assert.isTrue(windows.readObject("signtoolOptions").readString("sign").includes("windows-sign-hook"));
  }

  @TestMethod
  public signsOnWindowsWithoutAPublisherNameWhenTheCertificateNamesNone(): void {
    const configuration = PackageConfigurationTests.create(new PackageTarget("windows", "arm64"), true, null, false);

    const windows = PackageConfigurationTests.read(configuration).readObject("win");

    Assert.isFalse(windows.readObject("signtoolOptions").hasField("publisherName"));
    Assert.areEqual(JSON.stringify(["sha256"]), JSON.stringify(windows.readObject("signtoolOptions").readStringArray("signingHashAlgorithms")));
  }

  @TestMethod
  public describesAnUnsignedWindowsInstallerAndItsCommand(): void {
    const configuration = PackageConfigurationTests.create(new PackageTarget("windows", "x64"), false, null, false);

    const json = PackageConfigurationTests.read(configuration);
    const windows = json.readObject("win");
    const installer = json.readObject("nsis");

    Assert.isFalse(json.hasField("forceCodeSigning"));
    Assert.isFalse(windows.hasField("signtoolOptions"));
    Assert.isFalse(windows.hasField("signExts"));
    Assert.areEqual("Sample App-1.2.3-windows-x64.${ext}", windows.readString("artifactName"));
    Assert.areEqual(path.join(PackageConfigurationTests.ROOT, "assets", "icons", "icon-dark.ico"), windows.readString("icon"));
    Assert.areEqual(JSON.stringify([{ target: "nsis", arch: ["x64"] }]), JSON.stringify(windows.readValue("target")));
    Assert.areEqual(JSON.stringify([{ from: path.join(PackageConfigurationTests.ROOT, "_build", "package", "command", "sample-app.cmd"), to: "bin/sample-app.cmd" }]),
      JSON.stringify(windows.readValue("extraFiles")));
    Assert.areEqual("Sample App|Sample App|true|false|false", [installer.readString("shortcutName"), installer.readString("uninstallDisplayName"),
      installer.readBoolean("oneClick"), installer.readBoolean("perMachine"), installer.readBoolean("packElevateHelper")].join("|"));
    Assert.isTrue(installer.readString("include").endsWith(path.join("assets", "installer", "installer.nsh")));
  }

  @TestMethod
  public describesAnAppThatNamesNoFolderExactlyAsMainDid(): void {
    const cases: readonly (readonly [string, string, boolean, string | null, boolean])[] = [
      ["windows", "x64", false, null, false], ["windows", "arm64", true, "CN=Sample", true], ["macos", "arm64", true, null, false], ["macos", "x64", false, null, true],
      ["linux", "x64", false, null, false], ["linux", "arm64", false, null, true]];
    const cwd = JSON.stringify(process.cwd()).slice(1, -1);

    for (const [platform, architecture, isSigned, publisher, hasWebViews] of cases) {
      const target = new PackageTarget(platform, architecture).withInstallFolder(null);
      const json = JSON.stringify(PackageConfigurationTests.create(target, isSigned, publisher, hasWebViews).toJson(["node_modules/x/build/Release/x.node"]));

      Assert.areEqual(JSON.stringify(MainPackageConfigurationsFixture.configurations[`${platform}-${architecture}`]), json.replaceAll(cwd, "<cwd>").replaceAll("\\\\", "/"),
        `${platform}-${architecture}`);
    }
  }

  @TestMethod
  public installsInTheFolderTheAppNamesAndPutsItsStartMenuEntryInAFolderOfThatName(): void {
    const json = PackageConfigurationTests.read(PackageConfigurationTests.create(new PackageTarget("windows", "x64", true), false, null, false, PackageConfigurationTests.ROOT,
      PackageConfigurationTests.FOLDERED));

    Assert.areEqual("Sample Makers", json.readObject("nsis").readString("menuCategory"));
    Assert.isFalse(PackageConfigurationTests.read(PackageConfigurationTests.create(new PackageTarget("windows", "x64"), false, null, false)).readObject("nsis")
      .hasField("menuCategory"));
  }

  @TestMethod
  public describesASignedInstallerPackageInPlaceOfTheDiskImageForAnAppThatNamesAFolder(): void {
    const configuration = PackageConfigurationTests.create(new PackageTarget("macos", "arm64", true), true, null, false, PackageConfigurationTests.ROOT,
      PackageConfigurationTests.FOLDERED);

    const json = PackageConfigurationTests.read(configuration);

    Assert.isFalse(json.hasField("dmg"));
    Assert.areEqual(JSON.stringify({ installLocation: "/Applications/Sample Makers", isRelocatable: false, overwriteAction: "upgrade", allowAnywhere: false, allowCurrentUserHome: false,
      allowRootDirectory: true }), JSON.stringify(json.readValue("pkg")));
    Assert.areEqual(JSON.stringify([{ target: "pkg", arch: ["arm64"] }, { target: "zip", arch: ["arm64"] }]), JSON.stringify(json.readObject("mac").readValue("target")));
    Assert.isTrue(json.readObject("mac").readBoolean("notarize"));
    Assert.areEqual("Sample App-1.2.3-macos-arm64.pkg,Sample App-1.2.3-macos-arm64.zip", configuration.fileNames.join(","));
  }

  @TestMethod
  public describesADebianPackageWhoseScriptsAndProfileComeFromTheFolderedTemplates(): void {
    const json = PackageConfigurationTests.read(PackageConfigurationTests.create(new PackageTarget("linux", "x64", true), false, null, false, PackageConfigurationTests.ROOT,
      PackageConfigurationTests.FOLDERED));
    const templates = path.join(PackageConfigurationTests.ROOT, "_build", "package", "debian-templates");

    Assert.areEqual(JSON.stringify({ maintainer: "Sample", afterInstall: path.join(templates, "after-install.tpl"), afterRemove: path.join(templates, "after-remove.tpl"),
      appArmorProfile: path.join(templates, "apparmor-profile.tpl") }), JSON.stringify(json.readValue("deb")));
    Assert.areEqual(JSON.stringify([{ target: "AppImage", arch: ["x64"] }, { target: "deb", arch: ["x64"] }]), JSON.stringify(json.readObject("linux").readValue("target")));
  }

  @TestMethod
  public async writesElectronBuildersDebianTemplatesWithTheirPathsInTheFolderAsync(): Promise<void> {
    await using root = await PackageConfigurationTests.createRootAsync();
    const configuration = PackageConfigurationTests.create(new PackageTarget("linux", "x64", true), false, null, false, root.path, PackageConfigurationTests.FOLDERED);

    await configuration.writeAsync(path.join(root.path, "_build", "package", "electron-builder.json"));

    for (const file of ["after-install.tpl", "after-remove.tpl", "apparmor-profile.tpl"]) {
      const original = await readFile(path.join(PackageConfiguration.locateBuilderTemplates(), file), "utf8");
      const written = await readFile(path.join(root.path, "_build", "package", "debian-templates", file), "utf8");
      Assert.areEqual(original.replaceAll("/opt/${sanitizedProductName}/", "/opt/Sample Makers/${sanitizedProductName}/"), written, file);
      Assert.isTrue(written.includes("/opt/Sample Makers/${sanitizedProductName}/"), file);
    }
  }

  @TestMethod
  public refusesATemplateThatPlacesNothingUnderOpt(): void {
    const refusal = Assert.throws(() => PackageConfiguration.placeDebianTemplate("ln -sf '/usr/lib/${executable}'", "after-install.tpl", "Sample Makers"), BuildException);

    Assert.areEqual("electron-builder's Debian template after-install.tpl names no /opt/${sanitizedProductName}/, so the package can't move its paths into /opt/Sample Makers.",
      refusal.message);
  }

  @TestMethod
  public describesASignedMacPackageWithItsHardenedRuntimeAndNotarization(): void {
    const configuration = PackageConfigurationTests.create(new PackageTarget("macos", "arm64"), true, null, false);

    const json = PackageConfigurationTests.read(configuration);
    const mac = json.readObject("mac");

    Assert.isTrue(json.readBoolean("forceCodeSigning"));
    Assert.isTrue(json.readObject("dmg").readBoolean("sign"));
    Assert.isTrue(mac.readBoolean("hardenedRuntime"));
    Assert.isTrue(mac.readBoolean("notarize"));
    Assert.isTrue(mac.readString("entitlements").endsWith(path.join("assets", "macos", "entitlements.plist")));
    Assert.areEqual(mac.readString("entitlements"), mac.readString("entitlementsInherit"));
    Assert.isFalse(json.readObject("electronFuses").hasField("resetAdHocDarwinSignature"));
    Assert.areEqual(JSON.stringify([{ target: "dmg", arch: ["arm64"] }, { target: "zip", arch: ["arm64"] }]), JSON.stringify(mac.readValue("target")));
    Assert.areEqual(JSON.stringify([{ from: path.join(PackageConfigurationTests.ROOT, "_build", "package", "command", "sample-app"), to: "bin/sample-app" }]),
      JSON.stringify(mac.readValue("extraResources")));
  }

  @TestMethod
  public resetsTheAdHocSignatureOfAnUnsignedMacPackage(): void {
    const configuration = PackageConfigurationTests.create(new PackageTarget("macos", "x64"), false, null, false);

    const json = PackageConfigurationTests.read(configuration);

    Assert.isTrue(json.readObject("electronFuses").readBoolean("resetAdHocDarwinSignature"));
    Assert.isFalse(json.hasField("dmg"));
    Assert.isFalse(json.readObject("mac").hasField("hardenedRuntime"));
    Assert.isTrue(json.readObject("mac").readString("icon").endsWith("icon-dock-512.png"));
  }

  @TestMethod
  public describesALinuxAppImageAndTurnsCookieEncryptionOnForWebViews(): void {
    const configuration = PackageConfigurationTests.create(new PackageTarget("linux", "arm64"), false, null, true);

    const json = PackageConfigurationTests.read(configuration);
    const linux = json.readObject("linux");

    Assert.isTrue(json.readObject("electronFuses").readBoolean("enableCookieEncryption"));
    Assert.areEqual("1.0.3", json.readObject("toolsets").readString("appimage"));
    Assert.areEqual("sample-app|Sample App-1.2.3-linux-arm64.${ext}", `${linux.readString("executableName")}|${linux.readString("artifactName")}`);
    Assert.areEqual(JSON.stringify({ entry: { Name: "Sample App", StartupWMClass: "com.example.sample" } }), JSON.stringify(linux.readValue("desktop")));
    Assert.areEqual("Copyright (c) Sample|com.example.sample|Sample App", [json.readString("copyright"), json.readString("appId"), json.readString("productName")].join("|"));
  }

  @TestMethod
  public describesADebianPackageAlongsideTheAppImageNamingItsMaintainerAndHomepage(): void {
    const json = PackageConfigurationTests.read(PackageConfigurationTests.create(new PackageTarget("linux", "x64"), false, null, false));

    Assert.areEqual(JSON.stringify([{ target: "AppImage", arch: ["x64"] }, { target: "deb", arch: ["x64"] }]), JSON.stringify(json.readObject("linux").readValue("target")));
    Assert.areEqual(JSON.stringify({ maintainer: "Sample" }), JSON.stringify(json.readValue("deb")));
    Assert.areEqual(JSON.stringify({ homepage: "https://github.com/example/sample-app" }), JSON.stringify(json.readValue("extraMetadata")));
  }

  @TestMethod
  public namesTheProductsWebsiteAsTheDebianPackagesHomepageWhenItHasOne(): void {
    const manifest = JsonReader.fromValue({ desktop: { product: { ...PackageConfigurationTests.PRODUCT_FIELDS, about: { website: "https://sample.example" } } } });
    const root = PackageConfigurationTests.ROOT;
    const configuration = new PackageConfiguration(root, ProductIdentity.fromManifest(manifest), "1.2.3", new PackageTarget("linux", "arm64"), path.join(root, "stage"), path.join(root, "out"),
      path.join(root, "electron"), "44.5.1", false, null, false);

    Assert.areEqual(JSON.stringify({ homepage: "https://sample.example" }), JSON.stringify(PackageConfigurationTests.read(configuration).readValue("extraMetadata")));
  }

  @TestMethod
  public shipsTheAppsLicenseItsDictionariesWindowAndThirdPartyLicenses(): void {
    const configuration = PackageConfigurationTests.create(new PackageTarget("linux", "x64"), false, null, false);

    const [license, fonts, ...others] = PackageConfigurationTests.read(configuration).readObjectArray("extraResources").map(t => t.toJson());

    Assert.areEqual(JSON.stringify({ from: path.join(PackageConfigurationTests.ROOT, "LICENSE"), to: "licenses/LICENSE" }), JSON.stringify(license));
    Assert.areEqual(JSON.stringify(["licenses", ["*.txt"]]), JSON.stringify([fonts?.["to"], fonts?.["filter"]]));
    Assert.isTrue(String(fonts?.["from"]).endsWith(path.join("assets", "licenses", "fonts")), String(fonts?.["from"]));
    Assert.areEqual(JSON.stringify([
      { from: path.join(PackageConfigurationTests.ROOT, "assets", "dictionaries"), to: "licenses", filter: ["*.txt"] },
      { from: path.join(PackageConfigurationTests.ROOT, "stage", "_build", "window", "3rdpartylicenses.txt"), to: "licenses/window-third-party.txt" },
      { from: path.join(PackageConfigurationTests.ROOT, "_build", "package", "runtime-third-party.txt"), to: "licenses/runtime-third-party.txt" }
    ]), JSON.stringify(others));
  }

  @TestMethod
  public namesTheTargetsPackageFiles(): void {
    const configuration = PackageConfigurationTests.create(new PackageTarget("macos", "arm64"), false, null, false);

    Assert.areEqual("Sample App-1.2.3-macos-arm64.dmg,Sample App-1.2.3-macos-arm64.zip", configuration.fileNames.join(","));
  }

  @TestMethod
  public tellsWhetherAFileHasOneOfTheExtensionsWhateverItsCase(): void {
    Assert.isTrue(PackageConfiguration.hasExtension("Sample.EXE", [".exe", ".dll"]));
    Assert.isTrue(PackageConfiguration.hasExtension(path.join("folder", "pty.node"), [".node"]));
    Assert.isFalse(PackageConfiguration.hasExtension("Sample.cmd", [".exe", ".dll"]));
  }

  @TestMethod
  public async writesTheConfigurationAndTheWindowsCommand(): Promise<void> {
    await using root = await PackageConfigurationTests.createRootAsync();
    const configuration = PackageConfigurationTests.create(new PackageTarget("windows", "x64"), false, null, false, root.path);
    const file = path.join(root.path, "_build", "package", "electron-builder.json");

    await configuration.writeAsync(file, ["node_modules/sample/helper.exe"]);

    const json = JsonReader.parse(await readFile(file, "utf8"));
    const command = await readFile(path.join(root.path, "_build", "package", "command", "sample-app.cmd"), "utf8");
    Assert.areEqual(JSON.stringify(["**/*.node", "node_modules/sample/helper.exe"]), JSON.stringify(json.readStringArray("asarUnpack")));
    Assert.areEqual(["@echo off", "setlocal", "set ELECTRON_RUN_AS_NODE=1",
      "\"%~dp0..\\Sample App.exe\" \"%~dp0..\\resources\\app.asar\\node_modules\\@noldova\\desktop.cli\\services\\cli-entry.js\" %*", "exit /b %ERRORLEVEL%", String.empty]
      .join("\r\n"), command);
    Assert.isFalse(existsSync(path.join(root.path, "_build", "package", "command", "sample-app")));
  }

  @TestMethod
  public async writesTheConfigurationAndAnExecutableMacCommand(): Promise<void> {
    await using root = await PackageConfigurationTests.createRootAsync();
    const configuration = PackageConfigurationTests.create(new PackageTarget("macos", "arm64"), false, null, false, root.path);
    const file = path.join(root.path, "_build", "package", "electron-builder.json");

    await configuration.writeAsync(file);

    const command = await readFile(path.join(root.path, "_build", "package", "command", "sample-app"), "utf8");
    Assert.isTrue(command.startsWith("#!/bin/sh\n"), command);
    Assert.isTrue(command.endsWith("exec \"$resources/../MacOS/Sample App\" \"$resources/app.asar/node_modules/@noldova/desktop.cli/services/cli-entry.js\" \"$@\"\n"), command);
    Assert.areEqual(JSON.stringify(["**/*.node"]), JSON.stringify(JsonReader.parse(await readFile(file, "utf8")).readStringArray("asarUnpack")));
    Assert.isFalse(existsSync(path.join(root.path, "_build", "package", "command", "sample-app.cmd")));
  }

  @TestMethod
  public async writesOnlyTheConfigurationForLinux(): Promise<void> {
    await using root = await PackageConfigurationTests.createRootAsync();
    const configuration = PackageConfigurationTests.create(new PackageTarget("linux", "x64"), false, null, false, root.path);
    const file = path.join(root.path, "_build", "package", "electron-builder.json");

    await configuration.writeAsync(file);

    Assert.isTrue(existsSync(file));
    Assert.isFalse(existsSync(path.join(root.path, "_build", "package", "command")));
    Assert.isFalse(existsSync(path.join(root.path, "_build", "package", "debian-templates")));
  }

  private static create(target: PackageTarget, isSigned: boolean, publisher: string | null, hasWebViews: boolean, root: string = PackageConfigurationTests.ROOT,
    product: ProductIdentity = PackageConfigurationTests.PRODUCT): PackageConfiguration {
    return new PackageConfiguration(root, product, "1.2.3", target, path.join(root, "stage"), path.join(root, "out"), path.join(root, "electron"), "44.5.1",
      isSigned, publisher, hasWebViews);
  }

  private static read(configuration: PackageConfiguration): JsonReader {
    return JsonReader.parse(JSON.stringify(configuration.toJson([])));
  }

  private static async createRootAsync(): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "package-configuration-"));
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }
}
