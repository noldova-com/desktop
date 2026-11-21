/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { generateKeyPairSync } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { Resources } from "../../../src/resources.js";
import { Package } from "../../../src/services/commands/package.js";
import { PackageAssets } from "../../../src/services/packaging/package-assets.js";
import { LinuxSigning } from "../../../src/services/packaging/linux-signing.js";
import { PackageLayout } from "../../../src/services/packaging/package-layout.js";
import { PackageStage } from "../../../src/services/packaging/package-stage.js";
import { NpmCommand } from "../../../src/services/toolchain/npm-command.js";
import { InstalledAppFixture } from "../../fixtures/installed-app.fixture.js";
import { ModuleAppFixture } from "../../fixtures/module-app.fixture.js";
import { SignedMacBuilderRunnerFixture } from "../../fixtures/signed-mac-builder-runner.fixture.js";
import { StandInBuildFixture } from "../../fixtures/stand-in-build.fixture.js";
import { StandInBuilderRunnerFixture } from "../../fixtures/stand-in-builder-runner.fixture.js";
import { TarballFixture } from "../../fixtures/tarball.fixture.js";
import { TemporaryFolderRunnerFixture } from "../../fixtures/temporary-folder-runner.fixture.js";

class ProductStandInBuild extends StandInBuildFixture {
  public override async buildAsync(folder: string): Promise<void> {
    await super.buildAsync(folder);
    await writeFile(path.join(folder, "product.json"), JSON.stringify({ name: "Sample App" }));
  }
}

@TestClass
export class PackageTests {
  private static readonly DETACH_FAILURE: string = "dmgbuild.core.DMGError: Unable to detach device cleanly: hdiutil: couldn't eject \"disk2\" - Resource busy";
  private static readonly TERMS_PACKAGE: string = "sample-sdk";
  private static readonly TERMS: string = "SEE LICENSE IN README.md";
  private static readonly UNLICENSED_PACKAGES: readonly (readonly [string, string])[] = [["@xterm/addon-serialize", "0.14.0"], ["@xterm/headless", "6.0.0"], ["standardwebhooks", "1.1.1"]];
  private static readonly TYPES_ONLY_REASON: string = "The host bundles it and names it only in its declarations.";
  private static readonly OMITTED_REASON: string = "The app starts the program the person installed and never loads the bundled one.";
  private static readonly OMITTED_SHAPE: string = "1 The root package.json's desktop.packaging.omittedOptionals must map each package, as <name>@<version>, to "
    + "{ \"dependencies\": [<optional dependency name>, ...], \"reason\": \"<why the app never loads them>\" }.\n";
  private static readonly SIGNING_ACCOUNT: Readonly<Record<string, string>> = { endpoint: "https://sample.codesigning.example.com/", account: "sample-signing", profile: "SampleApp" };
  private static readonly SIGNING_NAME: string = "a name of letters, digits and hyphens that starts and ends with a letter or digit";
  private static readonly AZURE_CREDENTIALS: NodeJS.ProcessEnv = Object.fromEntries(["AZURE_TENANT_ID", "AZURE_CLIENT_ID", "AZURE_CLIENT_SECRET"].map(t => [t, "test-value"]));
  private static readonly PUBLISHER_NEEDED: string = "Signing Windows packages needs WINDOWS_PUBLISHER, the distinguished name of the signing certificate's subject, "
    + "starting with CN= and with its fields separated by \", \"";
  private static readonly MAC_CREDENTIALS: NodeJS.ProcessEnv = Object.fromEntries(
    ["MAC_CERTIFICATE", "MAC_CERTIFICATE_PASSWORD", "APPLE_API_KEY_P8", "APPLE_API_KEY_ID", "APPLE_API_ISSUER"].map(t => [t, "test-value"]));
  private static readonly PRODUCT_NAME: string = "Sample App";
  private static readonly PRODUCT_VERSION: string = "1.2.3";
  private static readonly FEED: string = "https://updates.example.test/app/";

  @TestMethod
  public async refusesToSignWindowsPackagesWithoutTheProductsSigningAccount(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const result = await app.packageAsync("win32", ["--signed"]);

    Assert.areEqual("1 Signing Windows packages needs desktop.product.windowsSigning in the root package.json, with the Artifact Signing endpoint, account and certificate profile.\n",
      result);
  }

  @TestMethod
  public async refusesWindowsSigningFieldsThatNameNoEndpointAccountOrProfile(): Promise<void> {
    const endpoint = await PackageTests.signWindowsAsync({ endpoint: "http://sample.codesigning.example.com/" });
    const account = await PackageTests.signWindowsAsync({ account: "-sample" });
    const profile = await PackageTests.signWindowsAsync({ profile: "Sample App" });

    Assert.areEqual("1 desktop.product.windowsSigning.endpoint in the root package.json must be the HTTPS URL of the Artifact Signing endpoint, ending in /.\n", endpoint);
    Assert.areEqual(`1 desktop.product.windowsSigning.account in the root package.json must be ${PackageTests.SIGNING_NAME}.\n`, account);
    Assert.areEqual(`1 desktop.product.windowsSigning.profile in the root package.json must be ${PackageTests.SIGNING_NAME}.\n`, profile);
  }

  @TestMethod
  public async takesTheWindowsSigningAccountFromTheProductAndThenNeedsItsServicePrincipal(): Promise<void> {
    const result = await PackageTests.signWindowsAsync({});

    Assert.areEqual("1 Signing Windows packages needs AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, "
      + "the Azure service principal for the signing account in desktop.product.windowsSigning.\n", result);
  }

  @TestMethod
  public async takesTheWindowsPublisherFromItsSecretAfterTheServicePrincipalAndSignsWithIt(): Promise<void> {
    const missing = await PackageTests.signWindowsAsync({}, { ...PackageTests.AZURE_CREDENTIALS });
    const other = await PackageTests.signWindowsAsync({}, { ...PackageTests.AZURE_CREDENTIALS, WINDOWS_PUBLISHER: "O=Sample, CN=Sample" });
    await using app = await InstalledAppFixture.createAsync({ windowsSigning: PackageTests.SIGNING_ACCOUNT });
    const environment: NodeJS.ProcessEnv = { ...PackageTests.AZURE_CREDENTIALS, WINDOWS_PUBLISHER: "CN=Sample, O=Sample" };
    await app.packageAsync("win32", ["--signed"], environment);
    const signed = (await app.readConfigurationAsync()).readObject("win").readObject("signtoolOptions").readString("publisherName");
    await app.packageAsync("win32");
    const unsigned = (await app.readConfigurationAsync()).readObject("win");

    Assert.areEqual(`1 ${PackageTests.PUBLISHER_NEEDED}; it is not set.\n`, missing);
    Assert.areEqual(`1 ${PackageTests.PUBLISHER_NEEDED}; it is set to something else.\n`, other);
    Assert.areEqual("CN=Sample, O=Sample", signed);
    Assert.isFalse(unsigned.hasField("signtoolOptions"));
    Assert.areEqual(0, Object.keys(environment).length);
  }

  @TestMethod
  public async refusesAWindowsPublisherInThePackageJson(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ windowsPublisher: "CN=Sample" });

    const result = await app.packageAsync("linux");

    Assert.areEqual("1 desktop.product.windowsPublisher no longer goes in package.json; remove it. A signed Windows package takes its publisher from the release's "
      + "WINDOWS_PUBLISHER secret.\n", result);
  }

  @TestMethod
  public async takesEachAssetFromTheAppBeforeDesktopBuildsDefault(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    await app.packageAsync("win32");
    const defaultInclude = (await app.readConfigurationAsync()).readObject("nsis").readString("include");
    const include = await app.writeAppFileAsync("assets/installer/installer.nsh", "; The app's own installer include\n");
    await app.packageAsync("win32");
    const ownInclude = (await app.readConfigurationAsync()).readObject("nsis").readString("include");
    const entitlements = await app.writeAppFileAsync("assets/macos/entitlements.plist", "<plist version=\"1.0\"><dict/></plist>\n");
    await app.packageAsync("darwin", ["--signed"], PackageTests.MAC_CREDENTIALS);
    const mac = (await app.readConfigurationAsync()).readObject("mac");

    Assert.isTrue(!defaultInclude.startsWith(app.path) && defaultInclude.endsWith(path.join("assets", "installer", "installer.nsh")), defaultInclude);
    Assert.areEqual(include, ownInclude);
    Assert.areEqual(entitlements, mac.readString("entitlements"));
    Assert.areEqual(entitlements, mac.readString("entitlementsInherit"));
  }

  @TestMethod
  public async shipsDesktopBuildsFontLicensesBesideTheAppsOwn(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const fonts = path.join(app.path, "assets", "licenses", "fonts");

    await app.packageAsync("linux");
    const defaults = await PackageTests.listFontLicensesAsync(app);
    await app.writeAppFileAsync("assets/licenses/fonts/Sample-OFL.txt", "Sample font license\n");
    await app.packageAsync("linux");
    const both = await PackageTests.listFontLicensesAsync(app);

    Assert.areEqual(1, defaults.length);
    Assert.isTrue(defaults[0] !== fonts, String(defaults[0]));
    Assert.areEqual(JSON.stringify([defaults[0], fonts]), JSON.stringify(both));
  }

  @TestMethod
  public async writesTheAppsMacOsAndLinuxCategories(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ categories: { macos: "public.app-category.productivity", linux: "Office" } });

    await app.packageAsync("darwin");
    const mac = (await app.readConfigurationAsync()).readObject("mac");
    await app.packageAsync("linux");
    const linux = (await app.readConfigurationAsync()).readObject("linux");

    Assert.areEqual("public.app-category.productivity", mac.readString("category"));
    Assert.areEqual("Office", linux.readString("category"));
  }

  @TestMethod
  public async refusesAnInvalidCategoryBeforePackaging(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ categories: { macos: "Developer Tools" } });

    const result = await app.packageAsync("linux");

    Assert.areEqual("1 The root package.json's desktop.product.categories.macos must be a macOS app category such as public.app-category.developer-tools.\n", result);
  }

  @TestMethod
  public async refusesAnAppWithoutItsLicenseBeforeBuilding(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({}, false);

    const result = await app.packageAsync("linux");

    Assert.areEqual("1 The app has no LICENSE, the license the package ships; Noldova Desktop brings no default for it, so the package cannot be built.\n", result);
  }

  @TestMethod
  public async refusesAnEntryPackageThatNeitherLockfileRecords(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI);

    const result = await app.packageAsync("linux");

    Assert.areEqual(`1 The build ships ${InstalledAppFixture.ELECTRON}, which the root package-lock.json does not lock; pin it in the root package.json and run npm install.\n`, result);
  }

  @TestMethod
  public async refusesAnInstalledCompanyPackageThatCameFromNoArchiveOfTheApps(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI, "https://registry.example.com/desktop-cli-0.0.12.tgz");
    await app.installAsync(InstalledAppFixture.ELECTRON);

    const result = await app.packageAsync("linux");

    Assert.areEqual(`1 ${InstalledAppFixture.CLI}@${InstalledAppFixture.VERSION} at node_modules/${InstalledAppFixture.CLI} is installed but not locked in package-lock.json, `
      + "and only a package installed from the app's own archive may ship unlocked.\n", result);
  }

  @TestMethod
  public async passesOverOnlyThePeersTheAppNamesAsTypesOnly(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({}, true,
      { typeOnlyPeers: { "peer-host@1.0.0": { peers: ["types-only"], reason: PackageTests.TYPES_ONLY_REASON } } });
    await app.installAsync(InstalledAppFixture.CLI, null, { "peer-host": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.lockAsync("peer-host", { "types-only": "^1.0.0", "loaded": "^1.0.0" });

    const refused = await app.packageAsync("linux");
    await app.lockAsync("peer-host", { "types-only": "^1.0.0" });
    const passed = await app.packageAsync("linux");

    Assert.areEqual("1 peer-host@1.0.0 at node_modules/peer-host needs the peer dependency loaded, which no shipped package brings and Electron does not provide, "
      + "so it would fail at runtime.\n", refused);
    Assert.isTrue(passed.startsWith("1 peer-host@1.0.0 could not be downloaded from http://127.0.0.1:9/peer-host-1.0.0.tgz: "), passed);
  }

  @TestMethod
  public async refusesTypeOnlyPeersWithoutAReason(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({}, true, { typeOnlyPeers: { "peer-host@1.0.0": { peers: ["types-only"] } } });

    const result = await app.packageAsync("linux");

    Assert.areEqual("1 The root package.json's desktop.packaging.typeOnlyPeers must map each package, as <name>@<version>, to "
      + "{ \"peers\": [<peer name>, ...], \"reason\": \"<why the package never loads them>\" }.\n", result);
  }

  @TestMethod
  public async refusesTypeOnlyPeersNamedWithoutTheirPackagesVersion(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({}, true, { typeOnlyPeers: { "peer-host": { peers: ["types-only"], reason: PackageTests.TYPES_ONLY_REASON } } });

    const result = await app.packageAsync("linux");

    Assert.areEqual("1 The root package.json's desktop.packaging.typeOnlyPeers must map each package, as <name>@<version>, to "
      + "{ \"peers\": [<peer name>, ...], \"reason\": \"<why the package never loads them>\" }.\n", result);
  }

  @TestMethod
  public async passesOverTypesOnlyPeersOnlyForTheVersionTheAppNames(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({}, true,
      { typeOnlyPeers: { "peer-host@0.9.0": { peers: ["types-only"], reason: PackageTests.TYPES_ONLY_REASON } } });
    await app.installAsync(InstalledAppFixture.CLI, null, { "peer-host": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.lockAsync("peer-host", { "types-only": "^1.0.0" });

    const result = await app.packageAsync("linux");

    Assert.areEqual("1 peer-host@1.0.0 at node_modules/peer-host needs the peer dependency types-only, which no shipped package brings and Electron does not provide, "
      + "so it would fail at runtime. The app names types-only peers only for peer-host@0.9.0.\n", result);
  }

  @TestMethod
  public async leavesOutOnlyTheOptionalDependenciesTheAppNamesForTheVersionItNames(): Promise<void> {
    const named = await PackageTests.packageSdkHostAsync({ "sdk-host@1.0.0": { dependencies: ["sdk-binary"], reason: PackageTests.OMITTED_REASON } });
    const other = await PackageTests.packageSdkHostAsync({ "sdk-host@0.9.0": { dependencies: ["sdk-binary"], reason: PackageTests.OMITTED_REASON } });
    const none = await PackageTests.packageSdkHostAsync(null);

    Assert.areEqual(JSON.stringify(["sdk-helper@1.0.0,sdk-host@1.0.0,sdk-required@1.0.0", "Optional dependencies left out: sdk-host@1.0.0's sdk-binary."]), JSON.stringify(named));
    Assert.areEqual(JSON.stringify(["sdk-binary@1.0.0,sdk-helper@1.0.0,sdk-host@1.0.0,sdk-required@1.0.0", "Optional dependencies left out: none."]), JSON.stringify(other));
    Assert.areEqual(JSON.stringify(other), JSON.stringify(none));
  }

  @TestMethod
  public async listsAsLeftOutOnlyWhatWouldOtherwiseShip(): Promise<void> {
    const omitted = { "sdk-host@1.0.0": { dependencies: ["sdk-binary"], reason: PackageTests.OMITTED_REASON } };
    const required = await PackageTests.packageSdkHostAsync(omitted, { dependencies: { "sdk-binary": "1.0.0" } });
    const otherPlatform = await PackageTests.packageSdkHostAsync(omitted, {}, { os: ["darwin"] });

    Assert.areEqual(JSON.stringify(["sdk-binary@1.0.0,sdk-helper@1.0.0,sdk-host@1.0.0,sdk-required@1.0.0", "Optional dependencies left out: none."]), JSON.stringify(required));
    Assert.areEqual(JSON.stringify(["sdk-helper@1.0.0,sdk-host@1.0.0,sdk-required@1.0.0", "Optional dependencies left out: none."]), JSON.stringify(otherPlatform));
  }

  @TestMethod
  public async refusesLeavingOutADependencyThatIsNotOptional(): Promise<void> {
    const [result] = await PackageTests.packageSdkHostAsync({ "sdk-host@1.0.0": { dependencies: ["sdk-binary", "sdk-required"], reason: PackageTests.OMITTED_REASON } });

    Assert.areEqual("1 desktop.packaging.omittedOptionals leaves out sdk-required of sdk-host@1.0.0, which is not one of its optional dependencies; "
      + "an app leaves out only an optional dependency it never loads.\n", result);
  }

  @TestMethod
  public async refusesOmittedOptionalsWithoutAReasonADependencyOrTheirPackagesVersion(): Promise<void> {
    const results: string[] = [];
    for (const omitted of [{ "sdk-host@1.0.0": { dependencies: ["sdk-binary"] } }, { "sdk-host@1.0.0": { dependencies: ["sdk-binary"], reason: " " } },
      { "sdk-host@1.0.0": { dependencies: [], reason: PackageTests.OMITTED_REASON } }, { "sdk-host@1.0.0": { dependencies: [" "], reason: PackageTests.OMITTED_REASON } },
      { "sdk-host@1.0.0": { dependencies: [1], reason: PackageTests.OMITTED_REASON } }, { "sdk-host": { dependencies: ["sdk-binary"], reason: PackageTests.OMITTED_REASON } }, []]) {
      await using app = await InstalledAppFixture.createAsync({}, true, { omittedOptionals: omitted });
      results.push(await app.packageAsync("linux"));
    }

    Assert.areEqual(JSON.stringify(Array(7).fill(PackageTests.OMITTED_SHAPE)), JSON.stringify(results));
  }

  @TestMethod
  public async warnsOfEntriesForVersionsTheAppDoesNotShip(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({}, true, {
      acceptedLicenses: { [`${PackageTests.TERMS_PACKAGE}@0.9.0`]: { license: PackageTests.TERMS, reason: "The app's owner accepted these terms." } },
      typeOnlyPeers: { "peer-host@0.9.0": { peers: ["types-only"], reason: PackageTests.TYPES_ONLY_REASON } },
      omittedOptionals: { "sdk-host@0.9.0": { dependencies: ["sdk-binary"], reason: PackageTests.OMITTED_REASON } }
    });
    await app.installAsync(InstalledAppFixture.CLI);
    await app.installAsync(InstalledAppFixture.ELECTRON);

    const result = await app.packageAsync("linux");

    Assert.isTrue(result.includes(`Warning: desktop.packaging.acceptedLicenses names ${PackageTests.TERMS_PACKAGE}@0.9.0, which the app does not ship; remove it.\n`
      + "Warning: desktop.packaging.typeOnlyPeers names peer-host@0.9.0, which the app does not ship; remove it.\n"
      + "Warning: desktop.packaging.omittedOptionals names sdk-host@0.9.0, which the app does not ship; remove it.\n"), result);
  }

  @TestMethod
  public async refusesATypesOnlyPeerThatThePackagesScriptsLoad(): Promise<void> {
    const [imported] = await PackageTests.packagePeerHostAsync({ "dist/index.mjs": "import { schema } from \"types-only/v4\";" });
    const [required] = await PackageTests.packagePeerHostAsync({ "index.cjs": "const peer = require( 'types-only' );" });
    const [, notices] = await PackageTests.packagePeerHostAsync({ "index.d.ts": "import type { Schema } from \"types-only\";", "index.js": "module.exports = \"types-only\";" });

    Assert.areEqual("1 peer-host@1.0.0 loads types-only in dist/index.mjs, so it would fail at runtime without it, but the app names types-only as a types-only peer of peer-host@1.0.0.\n", imported);
    Assert.areEqual("1 peer-host@1.0.0 loads types-only in index.cjs, so it would fail at runtime without it, but the app names types-only as a types-only peer of peer-host@1.0.0.\n", required);
    Assert.areEqual("peer-host@1.0.0\nLicense: MIT\n\nPeer host license\n", notices);
  }

  @TestMethod
  public async acceptsOnlyTheExactLicenseTheAppNamesAndShipsTheFileItNames(): Promise<void> {
    const [refused] = await PackageTests.packageTermsAsync("SEE LICENSE IN LICENSE.md", { "README.md": "Sample terms" });
    const [, notices] = await PackageTests.packageTermsAsync(PackageTests.TERMS, { "README.md": "Sample terms", "LICENSE": "Another license" });

    Assert.areEqual(`1 ${PackageTests.TERMS_PACKAGE}@1.0.0 is licensed under "${PackageTests.TERMS}"; a third-party runtime package needs `
      + "one of MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0, Python-2.0, Unlicense, or an OR expression with one of them.\n", refused);
    Assert.areEqual(`${PackageTests.TERMS_PACKAGE}@1.0.0\nLicense: ${PackageTests.TERMS}, accepted by the app\n\nSample terms\n`, notices);
  }

  @TestMethod
  public async refusesALicenseTheAppAcceptedForAnotherVersion(): Promise<void> {
    const [result] = await PackageTests.packageTermsAsync(PackageTests.TERMS, { "README.md": "Sample terms" }, "0.9.0");

    Assert.areEqual(`1 ${PackageTests.TERMS_PACKAGE}@1.0.0 is licensed under "${PackageTests.TERMS}"; a third-party runtime package needs `
      + "one of MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0, Python-2.0, Unlicense, or an OR expression with one of them. "
      + `The app accepts another license only for ${PackageTests.TERMS_PACKAGE}@0.9.0, so this version's terms need accepting again.\n`, result);
  }

  @TestMethod
  public async refusesAcceptedLicensesNamedWithoutTheirPackagesVersion(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({}, true,
      { acceptedLicenses: { [PackageTests.TERMS_PACKAGE]: { license: PackageTests.TERMS, reason: "The app's owner accepted these terms." } } });

    const result = await app.packageAsync("linux");

    Assert.areEqual("1 The root package.json's desktop.packaging.acceptedLicenses must map each package, as <name>@<version>, to "
      + "{ \"license\": \"<the exact license in its package.json>\", \"reason\": \"<why the app may ship it>\" }.\n", result);
  }

  @TestMethod
  public async shipsAPackageUnderTheUnlicense(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI, null, { "sample-hash": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("sample-hash", "Unlicense", { "UNLICENSE": "Public domain" });

    await app.packageAsync("linux");

    Assert.areEqual("sample-hash@1.0.0\nLicense: Unlicense\n\nPublic domain\n", await app.readThirdPartyNoticesAsync());
  }

  @TestMethod
  public async shipsDesktopBuildsReviewedLicenseTextsForPackagesThatShipNone(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const reviewed = new PackageAssets(app.path).list(Resources.reviewedLicensesSegments)[1] ?? String.empty;
    await app.installAsync(InstalledAppFixture.CLI, null, Object.fromEntries(PackageTests.UNLICENSED_PACKAGES));
    await app.installAsync(InstalledAppFixture.ELECTRON);
    for (const [name, version] of PackageTests.UNLICENSED_PACKAGES)
      await app.addThirdPartyAsync(name, "MIT", { "README.md": "Sample readme" }, {}, version);

    await app.packageAsync("linux");
    const notices = await app.readThirdPartyNoticesAsync() ?? String.empty;

    for (const [name, version] of PackageTests.UNLICENSED_PACKAGES) {
      const text = (await readFile(path.join(reviewed, `${name.replace("/", "+")}-${version}.txt`), "utf8")).trim();
      Assert.isTrue(notices.includes(`${name}@${version}\nLicense: MIT\n\n${text}\n`), `${name}@${version}: ${notices}`);
    }
  }

  @TestMethod
  public async shipsTheAppsReviewedLicenseTextBeforeDesktopBuilds(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI, null, { "@xterm/headless": "6.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("@xterm/headless", "MIT", { "README.md": "Sample readme" }, {}, "6.0.0");
    await app.writeAppFileAsync("assets/licenses/third-party/@xterm+headless-6.0.0.txt", "The app's reviewed text\n");

    await app.packageAsync("linux");

    Assert.areEqual("@xterm/headless@6.0.0\nLicense: MIT\n\nThe app's reviewed text\n", await app.readThirdPartyNoticesAsync());
  }

  @TestMethod
  public async refusesAPackageWithNeitherALicenseFileNorAReviewedText(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const [own, reviewed] = new PackageAssets(app.path).list(Resources.reviewedLicensesSegments);
    await app.installAsync(InstalledAppFixture.CLI, null, { "@sample/bare": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("@sample/bare", "MIT", { "README.md": "Sample readme" });

    const result = await app.packageAsync("linux");

    Assert.areEqual(`1 @sample/bare@1.0.0 has no license file in its tarball, such as LICENSE, LICENCE or COPYING, and neither ${path.join(own ?? String.empty, "@sample+bare-1.0.0.txt")} `
      + `nor ${path.join(reviewed ?? String.empty, "@sample+bare-1.0.0.txt")} holds a reviewed license text for it, so its license cannot ship.\n`, result);
  }

  @TestMethod
  public async keepsOutsideTheArchiveTheFilesAnInstalledPackageNames(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI, null, { "sample-script": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyTarballAsync("sample-script", TarballFixture.create({
      "package.json": JSON.stringify({ name: "sample-script", version: "1.0.0", license: "MIT", noldovaDesktop: { unpacked: ["jxa/script.js"] } }),
      "LICENSE": "Script license",
      "jxa/script.js": "console.log(\"sample\");\n",
      "jxa/other.js": "console.log(\"other\");\n"
    }));
    await app.writeAppFileAsync("node_modules/electron/dist/electron", String.empty);
    const runner = await TemporaryFolderRunnerFixture.createAsync(path.join(app.path, "temporary"));
    const stage = new PackageStage(app.path, new NpmCommand(runner, process.env), new StandInBuildFixture(app.path));
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));

    const exitCode = await new Package(app.path, "linux", "x64", stage, runner, {}, output, []).runAsync([]);

    Assert.areEqual(1, exitCode);
    Assert.isTrue(chunks.join(String.empty).endsWith("electron-builder failed with exit code 1.\n"), chunks.join(String.empty));
    Assert.areEqual(JSON.stringify(["**/*.node", "**/node_modules/sample-script/jxa/script.js"]), JSON.stringify((await app.readConfigurationAsync()).readStringArray("asarUnpack")));
  }

  @TestMethod
  public async keepsOutsideTheArchiveOnlyTheNativeFilesTheTargetShips(): Promise<void> {
    const native = "\u007fELF\u0002\u0001\u0001";
    const lists: (readonly string[])[] = [];
    for (const platform of ["linux", "win32"]) {
      await using app = await InstalledAppFixture.createAsync();
      await app.installAsync(InstalledAppFixture.CLI, null, { "sample-pty": "1.0.0" });
      await app.installAsync(InstalledAppFixture.ELECTRON);
      await app.addThirdPartyTarballAsync("sample-pty", TarballFixture.create({
        "package.json": JSON.stringify({ name: "sample-pty", version: "1.0.0", license: "MIT" }),
        "LICENSE": "Pty license",
        "prebuilds/linux-x64/pty.node": native,
        "prebuilds/win32-x64/conpty/OpenConsole.exe": native,
        "prebuilds/win32-x64/conpty/conpty.dll": native
      }));
      await app.writeAppFileAsync("node_modules/electron/dist/electron", String.empty);
      const runner = await TemporaryFolderRunnerFixture.createAsync(path.join(app.path, "temporary"));
      const stage = new PackageStage(app.path, new NpmCommand(runner, process.env), new StandInBuildFixture(app.path));

      await new Package(app.path, platform, "x64", stage, runner, {}, new PassThrough(), []).runAsync([]);
      lists.push((await app.readConfigurationAsync()).readStringArray("asarUnpack"));
    }

    Assert.areEqual(JSON.stringify([
      ["**/*.node", "**/node_modules/sample-pty/prebuilds/linux-x64/pty.node"],
      ["**/*.node", "**/node_modules/sample-pty/prebuilds/win32-x64/conpty/OpenConsole.exe", "**/node_modules/sample-pty/prebuilds/win32-x64/conpty/conpty.dll"]
    ]), JSON.stringify(lists));
  }

  @TestMethod
  public async refusesAnAcceptedLicenseWhoseNamedFileTheTarballLacks(): Promise<void> {
    const [result] = await PackageTests.packageTermsAsync(PackageTests.TERMS, { "LICENSE": "Another license" });

    Assert.areEqual(`1 ${PackageTests.TERMS_PACKAGE}@1.0.0 names its license in README.md, which its tarball does not hold, so its license cannot ship.\n`, result);
  }

  @TestMethod
  public async refusesAcceptedLicensesWithoutAReason(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({}, true, { acceptedLicenses: { [`${PackageTests.TERMS_PACKAGE}@1.0.0`]: { license: PackageTests.TERMS } } });

    const result = await app.packageAsync("linux");

    Assert.areEqual("1 The root package.json's desktop.packaging.acceptedLicenses must map each package, as <name>@<version>, to "
      + "{ \"license\": \"<the exact license in its package.json>\", \"reason\": \"<why the app may ship it>\" }.\n", result);
  }

  @TestMethod
  public async leavesEachModulesWindowPackageToTheWindowBuild(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    await app.installForPackagingAsync();
    const environment = await app.writeNpmAsync();

    const result = await app.packageAsync(environment);

    const { THIRD_PARTY, THIRD_PARTY_VERSION, UNREACHABLE_REGISTRY } = ModuleAppFixture;
    Assert.isTrue(result.startsWith(`1 ${THIRD_PARTY}@${THIRD_PARTY_VERSION} could not be downloaded from ${UNREACHABLE_REGISTRY}/${THIRD_PARTY}-${THIRD_PARTY_VERSION}.tgz: `), result);
    Assert.areEqual(JSON.stringify({ [ModuleAppFixture.RUNTIME_PACKAGE]: ModuleAppFixture.MODULE_VERSION }),
      JSON.stringify((await app.readPackedManifestAsync(ModuleAppFixture.MODULE_PACKAGE, ModuleAppFixture.MODULE_VERSION))["dependencies"]));
  }

  @TestMethod
  public async packsAModulePackageFromItsVerifiedArchiveNotFromItsInstalledCopy(): Promise<void> {
    const { MODULE_PACKAGE, MODULE_VERSION, RUNTIME, RUNTIME_PACKAGE, NEEDED, LONG_FILE } = ModuleAppFixture;
    await using app = await ModuleAppFixture.createAsync(NEEDED, NEEDED);
    await app.writeProductAsync();
    await app.installForPackagingAsync();
    await app.editInstalledManifestAsync(MODULE_PACKAGE, { description: "Changed after npm installed it." });

    await app.packageAsync(await app.writeNpmAsync());

    Assert.areEqual(JSON.stringify({ name: MODULE_PACKAGE, version: MODULE_VERSION, dependencies: { [RUNTIME_PACKAGE]: MODULE_VERSION }, peerDependencies: { [RUNTIME]: NEEDED } }),
      JSON.stringify(await app.readPackedManifestAsync(MODULE_PACKAGE, MODULE_VERSION)));
    Assert.areEqual(LONG_FILE, await app.readPackedSourceAsync(MODULE_PACKAGE, LONG_FILE));
  }

  @TestMethod
  public async refusesAnInstalledArchiveThatNoLongerMatchesTheIntegrityNpmRecorded(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI);
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.changeArchiveAsync(InstalledAppFixture.ELECTRON);

    const result = await app.packageAsync("linux");

    Assert.isTrue(result.startsWith("1 ") && result.endsWith(` no longer matches the integrity npm recorded when it installed ${InstalledAppFixture.ELECTRON}@${InstalledAppFixture.VERSION}; `
      + "build the app's packages and install the app again.\n"), result);
  }

  @TestMethod
  public async refusesAnInstalledPackageWhoseArchiveIsGone(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI);
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.removeArchiveAsync(InstalledAppFixture.ELECTRON);

    const result = await app.packageAsync("linux");

    Assert.isTrue(result.startsWith(`1 ${InstalledAppFixture.ELECTRON}@${InstalledAppFixture.VERSION} was installed from `)
      && result.endsWith(", which can no longer be read; build the app's packages and install the app again.\n"), result);
  }

  @TestMethod
  public async answersOptionsItDoesNotTakeWithItsUsageAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const results: string[] = [];
    for (const packageArguments of [["--signed", "--signed"], ["--quick"], ["--update-feed"], ["--update-feed", "ftp://updates.example.test/app/"]])
      results.push(await app.packageAsync("linux", packageArguments));

    Assert.areEqual(JSON.stringify(Array(4).fill(`2 ${Resources.packageUsage}`)), JSON.stringify(results));
  }

  @TestMethod
  public async refusesToSignAPackageForLinuxWithoutItsKeysAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const result = await app.packageAsync("linux", ["--signed"]);

    Assert.areEqual("1 Signing Linux packages needs LINUX_UPDATE_SIGNING_KEY, LINUX_UPDATE_PUBLIC_KEYS, the Ed25519 key that signs the update packages "
      + "and the public keys the app ships.\n", result);
  }

  @TestMethod
  public async signsALinuxBuildForTheUpdateFeedAndShipsTheKeysInItsProductFileAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await using plain = await InstalledAppFixture.createAsync();
    const layout = new PackageLayout(app.path);
    const signer = generateKeyPairSync("ed25519");
    const key = signer.publicKey.export({ type: "spki", format: "der" }).toString("base64");
    const credentials = { LINUX_UPDATE_SIGNING_KEY: signer.privateKey.export({ type: "pkcs8", format: "pem" }).toString(), LINUX_UPDATE_PUBLIC_KEYS: key };

    const result = await PackageTests.buildAsync(app, "linux", "x64", true, ["--signed"], { PATH: "/usr/bin", ...credentials }, undefined, new ProductStandInBuild(app.path));
    const product = JsonReader.parse(await readFile(layout.stagedProduct, "utf8"));
    const signatures = await LinuxSigning.readAsync(layout.updateSignatures);
    const report = JsonReader.parse(await readFile(layout.report, "utf8"));
    const names = PackageTarget.fromProcess("linux", "x64").listFileNames(PackageTests.PRODUCT_NAME, PackageTests.PRODUCT_VERSION);
    await plain.writeAppFileAsync("_build/package/update-signatures.json", "{}");
    const unsigned = await PackageTests.buildAsync(plain, "linux", "x64", true, [], {}, undefined, new ProductStandInBuild(plain.path));

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(result.output.includes(`Signed ${names.join(", ")} for the update feed.\nSignatures:\nEach of ${names.join(", ")} carries a valid signature by a key the app ships.\n`),
      result.output);
    Assert.areEqual(JSON.stringify([key]), JSON.stringify(product.readStringArray("linuxUpdateKeys")));
    Assert.areEqual(names.join(), [...signatures.keys()].join());
    Assert.areEqual("linux-x64,true,true", [report.readString("target"), String(report.readBoolean("signed")), String(report.readBoolean("checked"))].join());
    Assert.isTrue(Object.keys(credentials).every(t => Object.isUndefined(result.environments[0]?.[t])), JSON.stringify(result.environments));
    Assert.areEqual(0, unsigned.exitCode, unsigned.output);
    Assert.isFalse(existsSync(new PackageLayout(plain.path).updateSignatures));
    Assert.isFalse(JsonReader.parse(await readFile(new PackageLayout(plain.path).stagedProduct, "utf8")).hasField("linuxUpdateKeys"));
  }

  @TestMethod
  public async writesItsReportAfterTheBuilderMakesEveryPackageAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const layout = new PackageLayout(app.path);

    const result = await PackageTests.buildAsync(app, "linux", "x64", true, ["--update-feed", PackageTests.FEED], { PATH: "/usr/bin", SAMPLE_SECRET: "test-value" });
    const report = JsonReader.parse(await readFile(layout.report, "utf8"));
    const files = PackageTarget.fromProcess("linux", "x64").listFileNames(PackageTests.PRODUCT_NAME, PackageTests.PRODUCT_VERSION).map(t => path.join(layout.output, t));

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(result.output.endsWith(Resources.formatPackagesMade(files)), result.output);
    Assert.areEqual("linux-x64,false,false,false", [report.readString("target"), String(report.readBoolean("signed")), String(report.readBoolean("checked")),
      String(report.readBoolean("started"))].join());
    Assert.areEqual(1, result.environments.length);
    Assert.areEqual("/usr/bin", result.environments[0]?.["PATH"]);
    Assert.isTrue(Object.isUndefined(result.environments[0]?.["SAMPLE_SECRET"]));
    Assert.areEqual(layout.toolCache, result.environments[0]?.[Resources.builderCacheVariable]);
    Assert.areEqual(Resources.builderIdentityDiscoveryOff, result.environments[0]?.[Resources.builderIdentityDiscoveryVariable]);
    Assert.isTrue(Object.isUndefined(result.environments[0]?.[Resources.builderCompressionFilterVariable]));
  }

  @TestMethod
  public async namesTheInstallFolderToTheBuilderOnlyForAnAppThatNamesOneAsync(): Promise<void> {
    await using foldered = await InstalledAppFixture.createAsync({ installFolder: "Sample Makers" });
    await using plain = await InstalledAppFixture.createAsync();

    const named = await PackageTests.buildAsync(foldered, "linux", "x64", true);
    const unnamed = await PackageTests.buildAsync(plain, "linux", "x64", true);

    Assert.areEqual(0, named.exitCode, named.output);
    Assert.areEqual(0, unnamed.exitCode, unnamed.output);
    Assert.areEqual(`${new PackageLayout(foldered.path).configuration}|Sample Makers`, named.calls[0]?.slice(1).join("|"));
    Assert.areEqual(new PackageLayout(plain.path).configuration, unnamed.calls[0]?.slice(1).join("|"));
    Assert.isTrue(named.calls[0]?.[0]?.includes("package-builder") ?? false, JSON.stringify(named.calls));
  }

  @TestMethod
  public async checksEveryFolderTheBuilderMadeHoldsTheTargetsArchitectureAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const layout = new PackageLayout(app.path);
    const unpacked = path.join(layout.output, "linux-arm64-unpacked");

    const result = await PackageTests.buildAsync(app, "linux", "arm64", true, [], {}, (t, u) => new StandInBuilderRunnerFixture(t, u, [], new Map([
      [path.join(unpacked, "sample-app"), PackageTests.elf(183)],
      [path.join(unpacked, "resources", "app.asar.unpacked", "node_modules", "node-pty", "prebuilds", "linux-arm64", "pty.node"), PackageTests.elf(183)],
      [path.join(unpacked, "resources", "app.asar"), Buffer.from("sample")]
    ])));

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(result.output.endsWith(`${Resources.formatNativeArchitectureVerified(unpacked, 2, "arm64")}\n`), result.output);
    Assert.isTrue(existsSync(layout.report));
  }

  @TestMethod
  public async acceptsTheProgramsWindowsRunsOnAWindowsPackagesArchitectureAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const layout = new PackageLayout(app.path);
    const unpacked = path.join(layout.output, "win-arm64-unpacked");

    const result = await PackageTests.buildAsync(app, "win32", "arm64", true, [], {}, (t, u) => new StandInBuilderRunnerFixture(t, u, [], new Map([
      [path.join(unpacked, "Sample.exe"), PackageTests.pe(0xaa64)],
      [path.join(unpacked, "resources", "git", "usr", "bin", "ssh.exe"), PackageTests.pe(0x8664)],
      [path.join(unpacked, "resources", "git", "usr", "libexec", "getprocaddr32.exe"), PackageTests.pe(0x14c)]
    ])));

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(result.output.endsWith(`${Resources.formatWindowsMachinesVerified(unpacked, "arm64", ["arm64", "x64", "x86"], [["arm64", 1], ["x64", 1], ["x86", 1]])}\n`),
      result.output);
  }

  @TestMethod
  public async refusesABuiltFileOfAnotherArchitectureBeforeItsReportAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const layout = new PackageLayout(app.path);
    const addon = path.join(layout.output, "linux-arm64-unpacked", "resources", "app.asar.unpacked", "node_modules", "node-pty", "prebuilds", "linux-x64", "pty.node");

    const result = await PackageTests.buildAsync(app, "linux", "arm64", true, [], {}, (t, u) => new StandInBuilderRunnerFixture(t, u, [], new Map([
      [path.join(layout.output, "linux-arm64-unpacked", "sample-app"), PackageTests.elf(183)],
      [addon, PackageTests.elf(62)]
    ])));

    Assert.areEqual(1, result.exitCode, result.output);
    Assert.isTrue(result.output.endsWith(`The file ${addon} is x64, not an arm64-only ELF file, so it would not run natively on arm64.\n`), result.output);
    Assert.isFalse(existsSync(layout.report));
  }

  @TestMethod
  public async refusesABuildThatLeavesOutAPackageAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const layout = new PackageLayout(app.path);
    const files = PackageTarget.fromProcess("linux", "x64").listFileNames(PackageTests.PRODUCT_NAME, PackageTests.PRODUCT_VERSION).map(t => path.join(layout.output, t));

    const result = await PackageTests.buildAsync(app, "linux", "x64", false);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.endsWith(`${Resources.formatBuilderMissingFiles(files)}\n`), result.output);
  }

  @TestMethod
  public async compressesAWindowsArm64InstallerWithTheX86FilterAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const result = await PackageTests.buildAsync(app, "win32", "arm64", true);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(Resources.builderX86Filter, result.environments[0]?.[Resources.builderCompressionFilterVariable]);
  }

  @TestMethod
  public async checksEachMacOsUpdateArchiveAgainstTheAppItWasMadeFromAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const result = await PackageTests.buildAsync(app, "darwin", "x64", true);

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.includes(`electron-builder left 0 copies of ${PackageTests.PRODUCT_NAME}.app in `), result.output);
  }

  @TestMethod
  public async buildsAMacOsTargetAgainOnceWhenTheDiskImageCannotBeDetachedAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const result = await PackageTests.buildAsync(app, "darwin", "x64", true, [], {}, (t, u) => new StandInBuilderRunnerFixture(t, u, [PackageTests.DETACH_FAILURE]));

    Assert.areEqual(2, result.environments.length);
    Assert.isTrue(result.output.includes(Resources.builderDetachRetry), result.output);
    Assert.isFalse(result.output.includes(Resources.formatBuilderFailed(1)), result.output);
  }

  @TestMethod
  @TestData("darwin", "Unable to detach device cleanly", 2)
  @TestData("darwin", "Unable to read the disk image", 1)
  @TestData("linux", "Unable to detach device cleanly", 1)
  public async failsWithoutBuildingAgainForAnyOtherFailureOrTargetOrASecondDetachFailureAsync(platform: string, failure: string, runs: number): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const result = await PackageTests.buildAsync(app, platform, "x64", true, [], {}, (t, u) => new StandInBuilderRunnerFixture(t, u, [`dmgbuild.core.DMGError: ${failure}`, PackageTests.DETACH_FAILURE]));

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(runs, result.environments.length);
    Assert.isTrue(result.output.endsWith(`${Resources.formatBuilderFailed(1)}\n`), result.output);
  }

  @TestMethod
  public async signsNotarizesAndChecksASignedMacOsBuildAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const layout = new PackageLayout(app.path);
    const application = path.join(layout.output, "mac", `${PackageTests.PRODUCT_NAME}.app`);
    const [image = String.empty, archive = String.empty] = PackageTarget.fromProcess("darwin", "x64").listFileNames(PackageTests.PRODUCT_NAME, PackageTests.PRODUCT_VERSION).map(t => path.join(layout.output, t));
    const runners: SignedMacBuilderRunnerFixture[] = [];

    const result = await PackageTests.buildAsync(app, "darwin", "x64", true, ["--signed"], { ...PackageTests.MAC_CREDENTIALS }, (t, u) => {
      const runner = new SignedMacBuilderRunnerFixture(t, u, application);
      runners.push(runner);
      return runner;
    });
    const report = JsonReader.parse(await readFile(layout.report, "utf8"));

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(result.output.includes(`${Resources.formatPackagesMade([image, archive])}${Resources.formatMacNotarized(image, SignedMacBuilderRunnerFixture.SUBMISSION)}`
      + Resources.formatSignatures([Resources.formatAppleDiskImageVerified(image), Resources.formatAppleArchiveVerified(archive)].join("\n"))), result.output);
    Assert.isTrue(result.output.endsWith(`${Resources.formatMacUpdateVerified(archive, 3, 0)}\n`), result.output);
    Assert.areEqual("macos-x64,true,true,false", [report.readString("target"), String(report.readBoolean("signed")), String(report.readBoolean("checked")),
      String(report.readBoolean("started"))].join());
    Assert.areEqual(path.join(layout.signing, "notarization-key.p8"), result.environments[0]?.["APPLE_API_KEY"]);
    Assert.isFalse(existsSync(layout.signing));
    Assert.areEqual(["xcrun notarytool submit", "xcrun stapler staple", "codesign --verify", "codesign --display", "spctl", "xcrun stapler validate", "hdiutil attach",
      "codesign --verify", "codesign --display", "spctl", "xcrun stapler validate", "hdiutil detach", "ditto", "codesign --verify", "codesign --display", "spctl",
      "xcrun stapler validate", "ditto"].join("|"), runners[0]?.macCommands.join("|"));
    Assert.isTrue((runners[0]?.timeouts.length ?? 0) > 0 && (runners[0]?.timeouts.every(t => !Object.isUndefined(t) && t > 0 && t <= Resources.macPackagingLimit) ?? false),
      runners[0]?.timeouts.join() ?? String.empty);
  }

  @TestMethod
  public async namesElectronBuilderWhenSignedMacOsPackagingReachesItsLimitAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const application = path.join(new PackageLayout(app.path).output, "mac", `${PackageTests.PRODUCT_NAME}.app`);

    const result = await PackageTests.buildAsync(app, "darwin", "x64", true, ["--signed"], { ...PackageTests.MAC_CREDENTIALS },
      (t, u) => new SignedMacBuilderRunnerFixture(t, u, application, true));

    Assert.areEqual(Resources.failureExitCode, result.exitCode, result.output);
    Assert.isTrue(result.output.includes(Resources.formatPackagingLimitReached(Resources.macPackagingLimit, "electron-builder")), result.output);
  }

  @TestMethod
  public async keepsTheMacOsSigningKeyInTheRunnersTemporaryFolderAndRemovesItAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const temporary = path.join(app.path, "runner-temp");
    const layout = new PackageLayout(app.path, { RUNNER_TEMP: temporary });
    const application = path.join(layout.output, "mac", `${PackageTests.PRODUCT_NAME}.app`);

    const result = await PackageTests.buildAsync(app, "darwin", "x64", true, ["--signed"], { ...PackageTests.MAC_CREDENTIALS, RUNNER_TEMP: temporary },
      (t, u) => new SignedMacBuilderRunnerFixture(t, u, application));

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(path.join(temporary, "noldova-package-signing", "notarization-key.p8"), result.environments[0]?.["APPLE_API_KEY"]);
    Assert.isFalse(existsSync(layout.signing));
    Assert.isFalse(existsSync(new PackageLayout(app.path).signing));
  }

  @TestMethod
  public async throwsAFailureThatIsNotThePackagesOwnAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    await mkdir(new PackageLayout(app.path).configuration, { recursive: true });
    const runner = await TemporaryFolderRunnerFixture.createAsync(path.join(app.path, "temporary"));
    const stage = new PackageStage(app.path, new NpmCommand(runner, process.env), new StandInBuildFixture(app.path));

    const error = await Assert.throwsAsync(() => new Package(app.path, "linux", "x64", stage, runner, {}, new PassThrough(), []).runAsync([]), Error);

    Assert.isFalse(error instanceof BuildException, error.message);
  }

  private static pe(machine: number): Buffer {
    const file = Buffer.alloc(0x90);
    file.writeUInt16LE(0x5a4d, 0);
    file.writeUInt32LE(0x80, 0x3c);
    file.writeUInt32LE(0x00004550, 0x80);
    file.writeUInt16LE(machine, 0x84);
    return file;
  }

  private static elf(machine: number): Buffer {
    const header = Buffer.alloc(64);
    header.writeUInt32LE(0x464c457f, 0);
    header[4] = 2;
    header[5] = 1;
    header.writeUInt16LE(machine, 18);
    return header;
  }

  private static async buildAsync(app: InstalledAppFixture, platform: string, architecture: string, makesPackages: boolean, packageArguments: readonly string[] = [],
    environment: NodeJS.ProcessEnv = {},
    createRunner: (temporary: TemporaryFolderRunnerFixture, files: readonly string[]) => StandInBuilderRunnerFixture = (t, u) => new StandInBuilderRunnerFixture(t, u),
    build: StandInBuildFixture = new StandInBuildFixture(app.path)):
    Promise<{ readonly exitCode: number; readonly output: string; readonly environments: readonly NodeJS.ProcessEnv[]; readonly calls: readonly (readonly string[])[] }> {
    await app.installAsync(InstalledAppFixture.CLI);
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.writeAppFileAsync("node_modules/electron/dist/electron", String.empty);
    const layout = new PackageLayout(app.path);
    const files = makesPackages ? PackageTarget.fromProcess(platform, architecture).listFileNames(PackageTests.PRODUCT_NAME, PackageTests.PRODUCT_VERSION).map(t => path.join(layout.output, t)) : [];
    const temporary = await TemporaryFolderRunnerFixture.createAsync(path.join(app.path, "temporary"));
    const runner = createRunner(temporary, files);
    const stage = new PackageStage(app.path, new NpmCommand(temporary, process.env), build);
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    const exitCode = await new Package(app.path, platform, architecture, stage, runner, environment, output, []).runAsync(packageArguments);
    return { exitCode, output: chunks.join(String.empty), environments: runner.environments, calls: runner.calls };
  }

  private static async packageTermsAsync(accepted: string, files: Readonly<Record<string, string>>, version: string = "1.0.0"): Promise<readonly [string, string | null]> {
    await using app = await InstalledAppFixture.createAsync({}, true,
      { acceptedLicenses: { [`${PackageTests.TERMS_PACKAGE}@${version}`]: { license: accepted, reason: "The app's owner accepted these terms." } } });
    await app.installAsync(InstalledAppFixture.CLI, null, { [PackageTests.TERMS_PACKAGE]: "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync(PackageTests.TERMS_PACKAGE, PackageTests.TERMS, files);
    return [await app.packageAsync("linux"), await app.readThirdPartyNoticesAsync()];
  }

  private static async packageSdkHostAsync(omitted: Readonly<Record<string, unknown>> | null, requiredFields: Readonly<Record<string, unknown>> = {},
    binaryFields: Readonly<Record<string, unknown>> = {}): Promise<readonly [string, string]> {
    await using app = await InstalledAppFixture.createAsync({}, true, Object.isNull(omitted) ? null : { omittedOptionals: omitted });
    await app.installAsync(InstalledAppFixture.CLI, null, { "sdk-host": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("sdk-host", "MIT", { LICENSE: "SDK license" },
      { dependencies: { "sdk-required": "1.0.0" }, optionalDependencies: { "sdk-binary": "1.0.0", "sdk-helper": "1.0.0" } });
    const dependencies: readonly (readonly [string, Readonly<Record<string, unknown>>])[] = [["sdk-binary", binaryFields], ["sdk-helper", {}], ["sdk-required", requiredFields]];
    for (const [name, fields] of dependencies)
      await app.addThirdPartyAsync(name, "MIT", { LICENSE: `${name} license` }, fields);
    const result = await app.packageAsync("linux");
    const notices = await app.readThirdPartyNoticesAsync();
    return Object.isNull(notices) ? [result, String.empty]
      : [notices.split("\n").filter(t => /^sdk-[a-z]+@1\.0\.0$/.test(t)).join(), result.slice(result.indexOf(" ") + 1).split("\n").find(t => t.startsWith("Optional dependencies left out: ")) ?? String.empty];
  }

  private static async packagePeerHostAsync(files: Readonly<Record<string, string>>): Promise<readonly [string, string | null]> {
    await using app = await InstalledAppFixture.createAsync({}, true,
      { typeOnlyPeers: { "peer-host@1.0.0": { peers: ["types-only"], reason: PackageTests.TYPES_ONLY_REASON } } });
    await app.installAsync(InstalledAppFixture.CLI, null, { "peer-host": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("peer-host", "MIT", { LICENSE: "Peer host license", ...files });
    return [await app.packageAsync("linux"), await app.readThirdPartyNoticesAsync()];
  }

  private static async signWindowsAsync(fields: Readonly<Record<string, string>>, environment: NodeJS.ProcessEnv = {}): Promise<string> {
    await using app = await InstalledAppFixture.createAsync({ windowsSigning: { ...PackageTests.SIGNING_ACCOUNT, ...fields } });
    return await app.packageAsync("win32", ["--signed"], environment);
  }

  private static async listFontLicensesAsync(app: InstalledAppFixture): Promise<readonly string[]> {
    return (await app.readConfigurationAsync()).readObjectArray("extraResources")
      .map(t => t.readString("from")).filter(t => t.endsWith(path.join("licenses", "fonts")));
  }
}
