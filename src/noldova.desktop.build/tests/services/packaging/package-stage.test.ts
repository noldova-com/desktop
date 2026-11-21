/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { RootManifest } from "../../../src/models/packages/root-manifest.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { BuildLayout } from "../../../src/services/packages/build-layout.js";
import { PackageStage } from "../../../src/services/packaging/package-stage.js";
import { NpmCommand } from "../../../src/services/toolchain/npm-command.js";
import { InstalledAppFixture } from "../../fixtures/installed-app.fixture.js";
import { StandInBuildFixture } from "../../fixtures/stand-in-build.fixture.js";
import { TarballFixture } from "../../fixtures/tarball.fixture.js";
import { TemporaryFolderRunnerFixture } from "../../fixtures/temporary-folder-runner.fixture.js";

type OverrideForm = "nested" | "$" | "top-level" | "top-level with its own";

class ProductStandInBuild extends StandInBuildFixture {
  public override async buildAsync(folder: string): Promise<void> {
    await super.buildAsync(folder);
    await writeFile(path.join(folder, "product.json"), JSON.stringify({ name: "Sample App" }));
  }
}

@TestClass
export class PackageStageTests {
  private static readonly FIELDS: Readonly<Record<string, unknown>> = { name: "sample-app", version: "1.2.3", private: true };
  private static readonly FORMS: Readonly<Record<OverrideForm,
    readonly [Readonly<Record<string, unknown>>, Readonly<Record<string, unknown>>, Readonly<Record<string, unknown>>]>> = {
    "nested": [{ "sdk-host": { "shared-type": "2.1.0" } }, PackageStageTests.FIELDS, { "sdk-host": { "shared-type": "2.1.0" } }],
    "$": [{ "sdk-host": { "shared-type": "$shared-type" } }, { ...PackageStageTests.FIELDS, dependencies: { "shared-type": "2.1.0" } }, { "sdk-host": { "shared-type": "$shared-type" } }],
    "top-level": [{ "shared-type": "2.1.0", "absent-type": "1.0.0" }, PackageStageTests.FIELDS, { "shared-type": "$shared-type", "absent-type": "1.0.0" }],
    "top-level with its own": [{ "shared-type": { ".": "2.1.0", "absent-type": "1.0.0" } }, PackageStageTests.FIELDS, { "shared-type": { ".": "$shared-type", "absent-type": "1.0.0" } }]
  };
  private static readonly PACKAGES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    "sdk-host": { version: "1.0.0", dependencies: { "shared-type": "^1.0.5" } },
    "server-host": { version: "1.0.0", dependencies: { "shared-type": "^2.1.0" } },
    "shared-type": { version: "2.1.0" }
  };
  private static readonly PEERING: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    "desktop-host": { version: "1.0.0", dependencies: { "shared-type": "2.1.0" }, peerDependencies: { "electron": "44.9.1", "context-core": "1.0.0", "angular-core": "21.0.0" } },
    "context-core": { version: "1.0.0" },
    "shared-type": { version: "2.1.0" }
  };
  private static readonly TARGET: PackageTarget = PackageTarget.fromProcess("linux", "x64");
  private static readonly STOP_WAIT: number = 2_000;
  private static readonly OTHER_ARCHITECTURE: string = process.arch === "arm64" ? "x64" : "arm64";
  private static readonly INVALID: string = "The root package.json's overrides must be an object, as npm reads them.";
  private static readonly FAILED: string = "Installing the packages into the stage failed with exit code 1; it uses only the build's archives and never the registry:\n";

  @TestMethod
  @TestData("nested")
  @TestData("$")
  @TestData("top-level")
  @TestData("top-level with its own")
  public async installsOfflineWithTheAppsOverridesInEachFormSoTheDependentTakesTheOneVersionTheArchivesHold(form: OverrideForm): Promise<void> {
    const [overrides, fields, expected] = PackageStageTests.FORMS[form];
    await using stage = await PackageStageTests.createStageAsync();

    await PackageStage.installAsync(stage.npm, stage.path, new RootManifest("1.2.3", 1, overrides), fields, stage.cache, stage.archives, PackageStageTests.TARGET);
    const written = await readFile(path.join(stage.path, "package.json"), "utf8");

    Assert.areEqual("2.1.0", await PackageStageTests.readVersionAsync(path.join(stage.path, "node_modules", "shared-type")));
    Assert.isFalse(existsSync(path.join(stage.path, "node_modules", "sdk-host", "node_modules")));
    Assert.areEqual(`${JSON.stringify({ ...fields, overrides: expected }, null, 2)}\n`, written);
  }

  @TestMethod
  public async stagesTheContextPackagesAnInstalledPackageTakesAsPeersAmongTheAppsDependencies(): Promise<void> {
    const end = TemporaryFolderRunnerFixture.startTest();
    const context = "@noldova/context.core";
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(context);
    await app.installAsync(InstalledAppFixture.CLI, null, { "shared-type": "1.0.0" }, { [context]: ">=0.0.2 <0.1.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("shared-type", "MIT", { LICENSE: "Shared license" });
    const npm = new NpmCommand(await TemporaryFolderRunnerFixture.createAsync(path.join(app.path, "temporary"), end), process.env);
    const stage = new PackageStage(app.path, npm, new StandInBuildFixture(app.path));

    await stage.stageAsync(PackageTarget.fromProcess("linux", "x64"), new PassThrough(), null, null);
    const written = JsonReader.parse(await readFile(path.join(stage.folder, "package.json"), "utf8")).toJson();

    Assert.isTrue(JSON.stringify(written["dependencies"]).includes(`"${context}":"${InstalledAppFixture.VERSION}"`), JSON.stringify(written["dependencies"]));
    Assert.areEqual(InstalledAppFixture.VERSION, await PackageStageTests.readVersionAsync(path.join(stage.folder, "node_modules", ...context.split("/"))));
  }

  @TestMethod
  public async writesTheOptionalDependenciesInCodePointOrder(): Promise<void> {
    const end = TemporaryFolderRunnerFixture.startTest();
    const other = PackageStageTests.OTHER_ARCHITECTURE;
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI, null, { "addon-host": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("addon-host", "MIT", { LICENSE: "Host license" }, { optionalDependencies: { "addon_bound": "1.0.0", "addon-zeta": "1.0.0" } });
    await app.addThirdPartyAsync("addon_bound", "MIT", { LICENSE: "Bound license" }, { cpu: [other] });
    await app.addThirdPartyAsync("addon-zeta", "MIT", { LICENSE: "Zeta license" }, { cpu: [other] });
    const stage = new PackageStage(app.path, await PackageStageTests.createNpmAsync(app.path, end), new StandInBuildFixture(app.path));

    await stage.stageAsync(PackageTarget.fromProcess("linux", other), new PassThrough(), null, null);
    const written = JsonReader.parse(await readFile(path.join(stage.folder, "package.json"), "utf8")).toJson();

    Assert.areEqual(JSON.stringify({ "addon-zeta": "1.0.0", "addon_bound": "1.0.0" }), JSON.stringify(written["optionalDependencies"]));
  }

  @TestMethod
  public async stagesAPackageBoundToTheTargetsProcessorAsAnOptionalDependencyOnAHostOfAnother(): Promise<void> {
    const end = TemporaryFolderRunnerFixture.startTest();
    const other = PackageStageTests.OTHER_ARCHITECTURE;
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI, null, { "addon-host": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("addon-host", "MIT", { LICENSE: "Host license" }, { optionalDependencies: { "addon-zeta": "1.0.0", "addon-bound": "1.0.0" } });
    await app.addThirdPartyAsync("addon-zeta", "MIT", { LICENSE: "Zeta license" }, { cpu: [other] });
    await app.addThirdPartyAsync("addon-bound", "MIT", { LICENSE: "Bound license" }, { os: ["linux"], cpu: [other] });
    const stage = new PackageStage(app.path, await PackageStageTests.createNpmAsync(app.path, end), new StandInBuildFixture(app.path));

    await stage.stageAsync(PackageTarget.fromProcess("linux", other), new PassThrough(), null, null);
    const written = JsonReader.parse(await readFile(path.join(stage.folder, "package.json"), "utf8")).toJson();

    Assert.areEqual(JSON.stringify({ "addon-bound": "1.0.0", "addon-zeta": "1.0.0" }), JSON.stringify(written["optionalDependencies"]));
    Assert.areEqual("1.0.0,1.0.0", [await PackageStageTests.readVersionAsync(path.join(stage.folder, "node_modules", "addon-bound")),
      await PackageStageTests.readVersionAsync(path.join(stage.folder, "node_modules", "addon-zeta"))].join(","));
  }

  @TestMethod
  public async refusesAStageThatLeavesOutAnArchiveBoundToAnotherProcessorThanTheTargets(): Promise<void> {
    await using stage = await PackageStageTests.createStageAsync({ "addon-bound": { version: "1.0.0", cpu: [PackageStageTests.OTHER_ARCHITECTURE] } });

    const error = await Assert.throwsAsync(() => PackageStage.installAsync(stage.npm, stage.path, new RootManifest("1.2.3", 1),
      { ...PackageStageTests.FIELDS, optionalDependencies: { "addon-bound": "1.0.0" } }, stage.cache, stage.archives, PackageTarget.fromProcess(process.platform, process.arch)),
      BuildException);

    Assert.areEqual("Installing the packages into the stage left out addon-bound, which the stage ships for this target.", error.message);
  }

  @TestMethod
  public async installsOfflineArchivesThatDeclarePeersTheStageNeverShipsAndShipsOnlyThePeersItInstalls(): Promise<void> {
    await using stage = await PackageStageTests.createStageAsync(PackageStageTests.PEERING);

    await PackageStage.installAsync(stage.npm, stage.path, new RootManifest("1.2.3", 1), PackageStageTests.FIELDS, stage.cache, stage.archives, PackageStageTests.TARGET);
    const modules = path.join(stage.path, "node_modules");

    Assert.areEqual("1.0.0,1.0.0,2.1.0", [await PackageStageTests.readVersionAsync(path.join(modules, "desktop-host")),
      await PackageStageTests.readVersionAsync(path.join(modules, "context-core")), await PackageStageTests.readVersionAsync(path.join(modules, "shared-type"))].join(","));
    Assert.areEqual("false,false", [existsSync(path.join(modules, "electron")), existsSync(path.join(modules, "angular-core"))].join(","));
  }

  @TestMethod
  public async leavesATopLevelOverrideOfAShippedPackageThatIsNeitherAVersionNorAnObjectForNpmToRefuse(): Promise<void> {
    await using stage = await PackageStageTests.createStageAsync();

    const error = await Assert.throwsAsync(() => PackageStage.installAsync(stage.npm, stage.path, new RootManifest("1.2.3", 1, { "shared-type": 2 }), PackageStageTests.FIELDS,
      stage.cache, stage.archives, PackageStageTests.TARGET), BuildException);
    const written = JsonReader.parse(await readFile(path.join(stage.path, "package.json"), "utf8")).toJson();

    Assert.isTrue(error.message.startsWith(PackageStageTests.FAILED), error.message);
    Assert.areEqual(JSON.stringify({ "shared-type": 2 }), JSON.stringify(written["overrides"]));
  }

  @TestMethod
  public async reportsAnInstallStillRunningAtTheStallLimitWithWhatItWasDoing(): Promise<void> {
    const script = "setInterval(() => {}, 1_000)";

    const [folder, lines] = await PackageStageTests.stallAsync(script, 500);

    Assert.isTrue((lines[0] ?? String.empty).startsWith(`${path.basename(process.execPath)} -e ${script} ${folder} was still running after `), lines.join("\n"));
    Assert.isTrue(lines.includes("Its processes:"), lines.join("\n"));
    Assert.isTrue(lines.includes("It ended at SIGTERM."), lines.join("\n"));
    Assert.areEqual(process.platform === "darwin", lines.some(t => t === "Its sample:" || t.startsWith("The sample failed: ")), lines.join("\n"));
    Assert.areEqual(`npm wrote no log in ${path.join(folder, "temporary", "npm-logs")}.`, lines.at(-1));
  }

  @TestMethod
  public async killsAStalledInstallThatOutlivesSigterm(): Promise<void> {
    const marker = "const ready = require(\"node:path\").join(process.argv[1], \"handled\");";
    const script = `${marker} process.on("SIGTERM", () => {}); require("node:fs").writeFileSync(ready, ""); setInterval(() => {}, 1_000)`;
    const waits = `${marker} const watch = setInterval(() => { if (require("node:fs").existsSync(ready)) clearInterval(watch); }, 25);`;

    const [, lines] = await PackageStageTests.stallAsync(script, 500, t => [process.execPath, ["-e", waits, t]], PackageStageTests.STOP_WAIT);

    Assert.isTrue(lines.includes(process.platform === "win32" ? "It ended at SIGTERM." : "It outlived the wait after SIGTERM, and ended at SIGKILL."), lines.join("\n"));
  }

  @TestMethod
  public async reportsAStalledInstallWhoseExitComesSecondsAfterSigtermAsEndedAtSigterm(): Promise<void> {
    const marker = "const ready = require(\"node:path\").join(process.argv[1], \"handled\");";
    const script = `${marker} process.on("SIGTERM", () => setTimeout(() => process.exit(0), 4_000)); require("node:fs").writeFileSync(ready, ""); setInterval(() => {}, 1_000)`;
    const waits = `${marker} const watch = setInterval(() => { if (require("node:fs").existsSync(ready)) clearInterval(watch); }, 25);`;

    const [, lines] = await PackageStageTests.stallAsync(script, 500, t => [process.execPath, ["-e", waits, t]]);

    Assert.isTrue(lines.includes("It ended at SIGTERM."), lines.join("\n"));
  }

  @TestMethod
  public async stopsAStalledInstallTheListingMisses(): Promise<void> {
    const [, lines] = await PackageStageTests.stallAsync("setInterval(() => {}, 1_000)", 500, () => [process.execPath, ["-e", String.empty]]);
    const id = Number(lines.find(t => t.startsWith("Its process, "))?.split(", ")[1]);

    Assert.isTrue(Number.isInteger(id) && id > 0, lines.join("\n"));
    Assert.isTrue(lines.includes(`Its process, ${id}, was not found in the listing.`), lines.join("\n"));
    Assert.isTrue(lines.includes("It ended at SIGTERM."), lines.join("\n"));
    Assert.isFalse(PackageStageTests.isRunning(id), lines.join("\n"));
  }

  @TestMethod
  public async stopsAStalledInstallBeforeTheTestsEndWhenTheListingHangs(): Promise<void> {
    const [, lines] = await PackageStageTests.stallAsync("setInterval(() => {}, 1_000)", 500, () => [process.execPath, ["-e", "setInterval(() => {}, 1_000)"]], PackageStageTests.STOP_WAIT);

    Assert.isTrue(lines.some(t => t.startsWith("The listing failed: Error: Command failed: ")), lines.join("\n"));
    Assert.isTrue(lines.includes("It ended at SIGTERM."), lines.join("\n"));
  }

  @TestMethod
  public async failsOfflineWithoutTheOverridesAsTheDependentsOwnRangeAsksTheRegistry(): Promise<void> {
    await using stage = await PackageStageTests.createStageAsync();

    const error = await Assert.throwsAsync(() => PackageStage.installAsync(stage.npm, stage.path, new RootManifest("1.2.3", 1), PackageStageTests.FIELDS, stage.cache, stage.archives, PackageStageTests.TARGET),
      BuildException);

    Assert.isTrue(error.message.startsWith(PackageStageTests.FAILED) && error.message.includes("ENOTCACHED"), error.message);
  }

  @TestMethod
  public async stagesAnAppWhoseOverridesMoveANestedDependentOutsideItsOwnRangeOnlyWhileTheAppNamesThem(): Promise<void> {
    const end = TemporaryFolderRunnerFixture.startTest();
    const overrides = { "sdk-host": { "shared-type": "1.0.0" } };

    const [staged, version, written] = await PackageStageTests.stageSdkHostAsync(overrides, end);
    const [stagedTopLevel, topLevelVersion, writtenTopLevel] = await PackageStageTests.stageSdkHostAsync({ "shared-type": "1.0.0" }, end);
    const [refused] = await PackageStageTests.stageSdkHostAsync(null, end);

    Assert.isNull(staged);
    Assert.areEqual("1.0.0", version);
    Assert.areEqual(JSON.stringify(overrides), JSON.stringify(written));
    Assert.isNull(stagedTopLevel);
    Assert.areEqual("1.0.0", topLevelVersion);
    Assert.areEqual(JSON.stringify({ "shared-type": "$shared-type" }), JSON.stringify(writtenTopLevel));
    Assert.isTrue(!Object.isNull(refused) && refused.startsWith(PackageStageTests.FAILED) && refused.includes("ENOTCACHED"), String(refused));
  }

  @TestMethod
  public async refusesOverridesThatAreNotAnObjectBeforeItInstalls(): Promise<void> {
    await using stage = await PackageStageTests.createStageAsync();
    const errors: string[] = [];

    for (const overrides of [[], "shared-type@2.1.0", null])
      errors.push((await Assert.throwsAsync(() => PackageStage.installAsync(stage.npm, stage.path, new RootManifest("1.2.3", 1, overrides), PackageStageTests.FIELDS,
        stage.cache, stage.archives, PackageStageTests.TARGET), BuildException)).message);

    Assert.areEqual(JSON.stringify(Array<string>(3).fill(PackageStageTests.INVALID)), JSON.stringify(errors));
    Assert.isFalse(existsSync(path.join(stage.path, "package.json")));
  }

  @TestMethod
  public async writesTheWindowsPublisherIntoTheBuiltProductAndNamesTheLicensesTheAppAccepted(): Promise<void> {
    const end = TemporaryFolderRunnerFixture.startTest();
    const terms = "SEE LICENSE IN README.md";
    await using app = await InstalledAppFixture.createAsync({}, true,
      { acceptedLicenses: { "sample-sdk@1.0.0": { license: terms, reason: "The app's owner accepted these terms." } } });
    await app.installAsync(InstalledAppFixture.CLI, null, { "sample-sdk": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("sample-sdk", terms, { "README.md": "Sample terms" });
    const stage = new PackageStage(app.path, await PackageStageTests.createNpmAsync(app.path, end), new ProductStandInBuild(app.path));

    const output = await PackageStageTests.stageAsync(stage, "win32", "CN=Sample, O=Sample");
    const product = await readFile(path.join(stage.folder, "_build", "product.json"), "utf8");

    Assert.areEqual(JSON.stringify({ name: "Sample App", windowsPublisher: "CN=Sample, O=Sample" }), JSON.stringify(JsonReader.parse(product).toJson()));
    Assert.isTrue(output.includes(`Licenses the app accepted: sample-sdk@1.0.0 (${terms}).\n`), output);
  }

  @TestMethod
  public async refusesAPartOfAnInRepoModuleThatIsNoPackageUnderSrc(): Promise<void> {
    const end = TemporaryFolderRunnerFixture.startTest();
    await using app = await PackageStageTests.createInRepoModuleAppAsync();
    await app.writeAppFileAsync("src/noldova.desktop.tools/package.json", JSON.stringify({ name: "@noldova/desktop.tools", version: "__VERSION__" }));
    const stage = new PackageStage(app.path, await PackageStageTests.createNpmAsync(app.path, end), new StandInBuildFixture(app.path));

    const error = await Assert.throwsAsync(() => stage.stageAsync(PackageTarget.fromProcess("linux", "x64"), new PassThrough(), null, null), BuildException);

    Assert.areEqual("The stage needs @noldova/desktop.clock.runtime, which is not a package under src/.", error.message);
  }

  @TestMethod
  public async writesTheDependenciesInCodePointOrder(): Promise<void> {
    const end = TemporaryFolderRunnerFixture.startTest();
    const runtime = "@noldova/desktop.clock.runtime";
    const format = "@noldova/desktop.clock_format";
    await using app = await PackageStageTests.createInRepoModuleAppAsync();
    await app.writeAppFileAsync("src/modules/clock/runtime/package.json", JSON.stringify({ name: runtime, version: "__VERSION__", dependencies: { [format]: "__VERSION__" } }));
    await app.writeAppFileAsync("src/noldova.desktop.clock_format/package.json", JSON.stringify({ name: format, version: "__VERSION__" }));
    const archives = new BuildLayout(app.path).archivesFolder;
    await mkdir(archives, { recursive: true });
    for (const [name, version] of [[runtime, "0.0.1"], [format, "1.2.3"]] as const)
      await writeFile(path.join(archives, BuildLayout.nameArchive(name, version)), TarballFixture.create({ "package.json": JSON.stringify({ name, version, license: "MIT" }) }));
    const stage = new PackageStage(app.path, await PackageStageTests.createNpmAsync(app.path, end), new StandInBuildFixture(app.path));

    await PackageStageTests.stageAsync(stage, "linux", null);
    const names = Object.keys(JsonReader.parse(await readFile(path.join(stage.folder, "package.json"), "utf8")).readObject("dependencies").toJson());

    Assert.areEqual(JSON.stringify([runtime, format]), JSON.stringify(names.filter(t => t === runtime || t === format)));
  }

  @TestMethod
  public async stagesTheInRepoPackagesAnInRepoModuleShipsFromTheirArchivesAndLeavesOutTheRest(): Promise<void> {
    const end = TemporaryFolderRunnerFixture.startTest();
    const runtime = "@noldova/desktop.clock.runtime";
    const format = "@noldova/desktop.clockformat";
    await using app = await PackageStageTests.createInRepoModuleAppAsync();
    await app.writeAppFileAsync("src/modules/clock/runtime/package.json", JSON.stringify({ name: runtime, version: "__VERSION__", dependencies: { [format]: "__VERSION__" } }));
    await app.writeAppFileAsync("src/noldova.desktop.clockformat/package.json", JSON.stringify({ name: format, version: "__VERSION__" }));
    await app.writeAppFileAsync("src/noldova.desktop.tools/package.json", JSON.stringify({ name: "@noldova/desktop.tools", version: "__VERSION__" }));
    const archives = new BuildLayout(app.path).archivesFolder;
    await mkdir(archives, { recursive: true });
    for (const [name, version] of [[runtime, "0.0.1"], [format, "1.2.3"]] as const)
      await writeFile(path.join(archives, BuildLayout.nameArchive(name, version)), TarballFixture.create({ "package.json": JSON.stringify({ name, version, license: "MIT" }) }));
    const stage = new PackageStage(app.path, await PackageStageTests.createNpmAsync(app.path, end), new StandInBuildFixture(app.path));

    const output = await PackageStageTests.stageAsync(stage, "linux", null);
    const dependencies = JsonReader.parse(await readFile(path.join(stage.folder, "package.json"), "utf8")).readObject("dependencies");

    Assert.isTrue(output.includes(`Packages in the stage: ${format}, ${runtime}.\n`), output);
    Assert.areEqual("1.2.3", dependencies.readString(format));
    Assert.areEqual("0.0.1", dependencies.readString(runtime));
    Assert.isFalse(dependencies.hasField("@noldova/desktop.tools"));
    Assert.areEqual("0.0.1", await PackageStageTests.readVersionAsync(path.join(stage.folder, "node_modules", ...runtime.split("/"))));
    Assert.areEqual("1.2.3", await PackageStageTests.readVersionAsync(path.join(stage.folder, "node_modules", ...format.split("/"))));
  }

  private static async createInRepoModuleAppAsync(): Promise<InstalledAppFixture> {
    const app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI);
    await app.installAsync(InstalledAppFixture.ELECTRON);
    const text = await readFile(path.join(app.path, "package.json"), "utf8");
    const desktop = JsonReader.parse(text).readObject("desktop").toJson();
    await app.writeAppFileAsync("package.json", JSON.stringify({ ...JsonReader.parse(text).toJson(), desktop: { ...desktop, modules: ["clock"] } }));
    await app.writeAppFileAsync("src/modules/clock/module.json", JSON.stringify({
      id: "clock",
      version: "0.0.1",
      displayName: "Clock",
      description: "A module the app builds from its own tree.",
      parts: ["runtime"],
      dependencies: {},
      contributes: {}
    }));
    await app.writeAppFileAsync("src/modules/clock/runtime/runtime-part.ts", String.empty);
    return app;
  }

  private static async createNpmAsync(root: string, end: number): Promise<NpmCommand> {
    return new NpmCommand(await TemporaryFolderRunnerFixture.createAsync(path.join(root, "temporary"), end), process.env);
  }

  private static async stageAsync(stage: PackageStage, platform: string, windowsPublisher: string | null): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await stage.stageAsync(PackageTarget.fromProcess(platform, "x64"), output, null, windowsPublisher);
    return chunks.join(String.empty);
  }

  private static async stageSdkHostAsync(overrides: Readonly<Record<string, unknown>> | null, end: number): Promise<readonly [string | null, string | null, unknown]> {
    await using app = await InstalledAppFixture.createAsync();
    await app.installAsync(InstalledAppFixture.CLI, null, { "sdk-host": "1.0.0" });
    await app.installAsync(InstalledAppFixture.ELECTRON);
    await app.addThirdPartyAsync("sdk-host", "MIT", { LICENSE: "SDK license" }, { dependencies: { "shared-type": "^0.9.0" } });
    await app.addThirdPartyAsync("shared-type", "MIT", { LICENSE: "Shared license" });
    if (!Object.isNull(overrides)) {
      const manifest = JsonReader.parse(await readFile(path.join(app.path, "package.json"), "utf8")).toJson();
      await app.writeAppFileAsync("package.json", JSON.stringify({ ...manifest, overrides }));
    }
    const npm = new NpmCommand(await TemporaryFolderRunnerFixture.createAsync(path.join(app.path, "temporary"), end), process.env);
    const stage = new PackageStage(app.path, npm, new StandInBuildFixture(app.path));

    const failure = await stage.stageAsync(PackageTarget.fromProcess("linux", "x64"), new PassThrough(), null, null).then(() => null, (error: unknown) => {
      if (!(error instanceof BuildException))
        throw error;
      return error.message;
    });
    if (!Object.isNull(failure))
      return [failure, null, null];
    const written = JsonReader.parse(await readFile(path.join(stage.folder, "package.json"), "utf8")).toJson();
    return [null, await PackageStageTests.readVersionAsync(path.join(stage.folder, "node_modules", "shared-type")), written["overrides"]];
  }

  private static async stallAsync(script: string, stall: number, listing: ((folder: string) => readonly [string, readonly string[]]) | null = null,
    wait: number = Number.POSITIVE_INFINITY): Promise<readonly [string, readonly string[]]> {
    const folder = await mkdtemp(path.join(tmpdir(), "package-stage-"));
    try {
      const runner = await TemporaryFolderRunnerFixture.createAsync(path.join(folder, "temporary"), TemporaryFolderRunnerFixture.stallAfter(stall),
        Object.isNull(listing) ? null : listing(folder), wait);

      const error = await Assert.throwsAsync(() => runner.captureAsync(process.execPath, ["-e", script, folder], tmpdir(), 600_000), BuildException);

      return [folder, error.message.split("\n")];
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  private static isRunning(id: number): boolean {
    try {
      return process.kill(id, 0);
    }
    catch {
      return false;
    }
  }

  private static async readVersionAsync(folder: string): Promise<string> {
    return JsonReader.parse(await readFile(path.join(folder, "package.json"), "utf8")).readString("version");
  }

  private static async createStageAsync(packages: Readonly<Record<string, Readonly<Record<string, unknown>>>> = PackageStageTests.PACKAGES):
    Promise<{ path: string, cache: string, archives: ReadonlyMap<string, string>, npm: NpmCommand } & AsyncDisposable> {
    const end = TemporaryFolderRunnerFixture.startTest();
    const folder = await mkdtemp(path.join(tmpdir(), "package-stage-"));
    const archives = new Map<string, string>();
    for (const [name, fields] of Object.entries(packages)) {
      const archive = path.join(folder, `${name}-${String(fields["version"])}.tgz`);
      await writeFile(archive, TarballFixture.create({ "package.json": JSON.stringify({ name, license: "MIT", ...fields }) }));
      archives.set(name, archive);
    }
    const stage = path.join(folder, "stage");
    await mkdir(stage);
    return {
      path: stage,
      cache: path.join(folder, "cache"),
      archives,
      npm: new NpmCommand(await TemporaryFolderRunnerFixture.createAsync(path.join(folder, "temporary"), end), process.env),
      [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })
    };
  }
}
