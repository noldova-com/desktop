/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { BuildVariant } from "../../../src/models/modules/build-variant.js";
import { PackageManifest } from "../../../src/models/packages/package-manifest.js";
import { Resources } from "../../../src/resources.js";
import { BuildLayout } from "../../../src/services/packages/build-layout.js";
import { PackageBuild } from "../../../src/services/packages/package-build.js";
import { type IPackageToolsAnswers, PackageToolsRunnerFixture } from "../../fixtures/package-tools-runner.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class PackageBuildTests {
  private static readonly PROTOCOL: string = "src/noldova.desktop.protocol";
  private static readonly STYLES: string = "src/noldova.desktop.styles";
  private static readonly RUNTIME: string = "src/noldova.desktop.runtime";
  private static readonly WINDOW: string = "src/noldova.desktop.window";
  private static readonly GALLERY: string = "src/noldova.desktop.gallery";
  private static readonly FIXTURES: string = "src/noldova.desktop.electron/tests/e2e/fixtures/modules/clock";
  private static readonly ROOT: Readonly<Record<string, string>> = { "package.json": JSON.stringify({ name: "app", version: "1.2.3" }), "LICENSE": "License\n" };
  private static readonly END: string = "end of copies\n";
  private static readonly VERSION: string = "1.2.3";
  private static readonly TEST: BuildVariant = new BuildVariant(true, []);
  private static readonly ANGULAR: Readonly<Record<string, unknown>> = { peerDependencies: { "@angular/core": "22.0.0" } };
  private static readonly BUILD_ROOT: Readonly<Record<string, string>> = {
    "package.json": JSON.stringify({ name: "app", version: "1.2.3", desktop: { modules: [], protocolVersion: 3 } }),
    "LICENSE": "License\n",
    "node_modules/typescript/package.json": JSON.stringify({ name: "typescript", version: "5.9.3" })
  };
  private static readonly WINDOW_APP: Readonly<Record<string, string>> = {
    "src/app.window.app/angular.json": "{}",
    "src/app.window.app/package.json": JSON.stringify({ name: "app-window", private: true }),
    "src/app.window.app/tsconfig.json": "{}"
  };
  private static readonly LOCKFILE: string = JSON.stringify({ name: "app", lockfileVersion: 3, packages: {
    "node_modules/@angular/cdk": { version: "22.2.7", peerDependencies: { "@angular/common": "^22.0.0" } },
    "node_modules/@angular/common": { version: "22.2.6" }
  } });
  private static readonly SCRIPT: string = "src/noldova.desktop.styles/scripts/build.ts";
  private static readonly INSTALLED: string = "Angular packages built and installed: 1.\n";
  private static readonly REUSED_INSTALL: string = "Angular packages built: 1; the app's install already holds them, unchanged since the last build.\n";

  @TestMethod
  public async listsEachFileTheBuildCopiesIntoAPackageWithItsSourceItsPackageAndItsPathThereThenTheLastLine(): Promise<void> {
    const protocol = PackageManifest.formatName(PackageBuildTests.PROTOCOL);
    const styles = PackageManifest.formatName(PackageBuildTests.STYLES);
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.ROOT,
      [`${PackageBuildTests.PROTOCOL}/package.json`]: JSON.stringify({ name: protocol, version: "__VERSION__" }),
      [`${PackageBuildTests.PROTOCOL}/README.md`]: "# Protocol\n",
      [`${PackageBuildTests.PROTOCOL}/src/assets/icons/mark.svg`]: "<svg/>\n",
      [`${PackageBuildTests.PROTOCOL}/src/api/index.d.ts`]: "export {};\n",
      [`${PackageBuildTests.PROTOCOL}/src/api/index.ts`]: "export {};\n",
      [`${PackageBuildTests.PROTOCOL}/src/api/extra.d.ts`]: "export {};\n",
      [`${PackageBuildTests.STYLES}/package.json`]: JSON.stringify({ name: styles, version: "__VERSION__" }),
      [`${PackageBuildTests.STYLES}/scripts/build.ts`]: "if (process.argv[2] === \"--inputs\")\n  process.stdout.write(\"shared/fonts\\n\");\n",
      "shared/fonts/face.woff2": "font\n"
    });

    const [exitCode, output] = await PackageBuildTests.runAsync(tree, ["build", "--list-copies"]);

    Assert.areEqual(0, exitCode);
    Assert.areEqual([
      `LICENSE\t${protocol}\tLICENSE`,
      `${PackageBuildTests.PROTOCOL}/README.md\t${protocol}\tREADME.md`,
      `${PackageBuildTests.PROTOCOL}/src/assets/icons/mark.svg\t${protocol}\tassets/icons/mark.svg`,
      `${PackageBuildTests.PROTOCOL}/src/api/extra.d.ts\t${protocol}\tapi/extra.d.ts`,
      `${PackageBuildTests.PROTOCOL}/src/api/index.d.ts\t${protocol}\tapi/index.d.ts`,
      `LICENSE\t${styles}\tLICENSE`,
      `shared/fonts/face.woff2\t${styles}\tfonts/face.woff2`,
      String.empty
    ].join("\n") + PackageBuildTests.END, output);
  }

  @TestMethod
  public async listsOnlyTheCopiesThePackageFilesKeepInItsArchive(): Promise<void> {
    const protocol = PackageManifest.formatName(PackageBuildTests.PROTOCOL);
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.ROOT,
      [`${PackageBuildTests.PROTOCOL}/package.json`]: JSON.stringify({ name: protocol, version: "__VERSION__", files: ["**/*.js", "api/index.d.ts", "assets/icons/"] }),
      [`${PackageBuildTests.PROTOCOL}/README.md`]: "# Protocol\n",
      [`${PackageBuildTests.PROTOCOL}/src/assets/icons/mark.svg`]: "<svg/>\n",
      [`${PackageBuildTests.PROTOCOL}/src/assets/notes.txt`]: "Notes\n",
      [`${PackageBuildTests.PROTOCOL}/src/api/index.d.ts`]: "export {};\n",
      [`${PackageBuildTests.PROTOCOL}/src/api/extra.d.ts`]: "export {};\n"
    });

    Assert.areEqual(JSON.stringify([0, [
      `LICENSE\t${protocol}\tLICENSE`,
      `${PackageBuildTests.PROTOCOL}/README.md\t${protocol}\tREADME.md`,
      `${PackageBuildTests.PROTOCOL}/src/assets/icons/mark.svg\t${protocol}\tassets/icons/mark.svg`,
      `${PackageBuildTests.PROTOCOL}/src/api/index.d.ts\t${protocol}\tapi/index.d.ts`,
      String.empty
    ].join("\n") + PackageBuildTests.END]), JSON.stringify(await PackageBuildTests.runAsync(tree, ["build", "--list-copies"])));
  }

  @TestMethod
  public async reportsAPackageWhoseFilesAreNoArrayOfPatterns(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.ROOT,
      [`${PackageBuildTests.PROTOCOL}/package.json`]: JSON.stringify({ name: PackageManifest.formatName(PackageBuildTests.PROTOCOL), version: "__VERSION__", files: "api" })
    });

    Assert.areEqual(JSON.stringify([1, `${PackageBuildTests.PROTOCOL}/package.json must list its files in an array of patterns.\n`]),
      JSON.stringify(await PackageBuildTests.runAsync(tree, ["build", "--list-copies"])));
  }

  @TestMethod
  public async endsAnEmptyListWithTheLastLineAlone(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync(PackageBuildTests.ROOT);

    Assert.areEqual(JSON.stringify([0, PackageBuildTests.END]), JSON.stringify(await PackageBuildTests.runAsync(tree, ["build", "--list-copies"])));
  }

  @TestMethod
  public async reportsAPackageWithoutItsDeclarationsAndNoLastLine(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.ROOT,
      [`${PackageBuildTests.PROTOCOL}/package.json`]: JSON.stringify({ name: PackageManifest.formatName(PackageBuildTests.PROTOCOL), version: "__VERSION__" })
    });

    Assert.areEqual(JSON.stringify([1, `${PackageBuildTests.PROTOCOL} has no src/api/index.d.ts.\n`]), JSON.stringify(await PackageBuildTests.runAsync(tree, ["build", "--list-copies"])));
  }

  @TestMethod
  public async takesNoOtherOptionWithTheList(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync(PackageBuildTests.ROOT);

    const [exitCode, output] = await PackageBuildTests.runAsync(tree, ["build", "--test", "--list-copies"]);

    Assert.areEqual(2, exitCode);
    Assert.isTrue(output.startsWith("Usage: noldova-desktop-build build [") && output.includes("| --list-copies]"), output);
  }

  @TestMethod
  public async buildsEachPackageAfterThoseItDependsOnAndReusesItWhileNothingChanged(): Promise<void> {
    const { PROTOCOL, RUNTIME } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PROTOCOL),
      [`${PROTOCOL}/src/resources.ts`]: "export const protocolVersion = __PROTOCOL_VERSION__;\n",
      [`${PROTOCOL}/tests/tsconfig.json`]: "{}",
      [`${PROTOCOL}/tests/protocol.test.ts`]: "export {};\n",
      ...PackageBuildTests.describePackage(RUNTIME, [PROTOCOL]),
      [`${RUNTIME}/src/resources.ts`]: "export const name = \"runtime\";\n",
      ...PackageBuildTests.describePackage(PackageBuildTests.WINDOW, [PROTOCOL], PackageBuildTests.ANGULAR),
      ...PackageBuildTests.describePackage(PackageBuildTests.GALLERY, [PackageBuildTests.WINDOW])
    });
    const runner = new PackageToolsRunnerFixture(tree.path);
    const build = PackageBuildTests.create(tree, runner);
    const protocol = PackageManifest.formatName(PROTOCOL);
    const runtime = PackageManifest.formatName(RUNTIME);

    const first = await PackageBuildTests.collectAsync(t => build.buildAsync(t));
    const second = await PackageBuildTests.collectAsync(t => build.buildAsync(t));

    Assert.areEqual(`${protocol}: built\n${runtime}: built\n${protocol} tests: compiled\n`, first);
    Assert.areEqual(`${protocol}: reused\n${runtime}: reused\n${protocol} tests: reused\n`, second);
    Assert.areEqual(JSON.stringify([
      `compile ${PROTOCOL}/src/tsconfig.json`,
      "pack noldova.desktop.protocol",
      "install",
      `compile ${RUNTIME}/src/tsconfig.json`,
      "pack noldova.desktop.runtime",
      "install",
      `compile ${PROTOCOL}/tests/tsconfig.json`
    ]), JSON.stringify(runner.calls));
    Assert.areEqual(JSON.stringify([[PackageBuildTests.archive(PROTOCOL)], [PackageBuildTests.archive(PROTOCOL), PackageBuildTests.archive(RUNTIME)]]), JSON.stringify(runner.installs));
    Assert.areEqual("export const protocolVersion = 3;\n", await PackageBuildTests.readBuiltAsync(tree, PROTOCOL, "resources.js"));
    Assert.areEqual("export const name = \"runtime\";\n", await PackageBuildTests.readBuiltAsync(tree, RUNTIME, "resources.js"));
    Assert.areEqual("export {};\n", await PackageBuildTests.readBuiltAsync(tree, PROTOCOL, "api/index.d.ts"));
    Assert.areEqual(JSON.stringify({ [protocol]: PackageBuildTests.VERSION }),
      JSON.stringify(JsonReader.parse(await readFile(path.join(tree.path, "node_modules", ...runtime.split("/"), "package.json"), "utf8")).readObject("dependencies").toJson()));
    Assert.isTrue(existsSync(path.join(tree.path, "_build", "tests", "noldova.desktop.protocol", "tests", "protocol.test.js")));
    Assert.isTrue(existsSync(path.join(tree.path, "_build", "tests", "noldova.desktop.protocol", "src", "package.json")));
  }

  @TestMethod
  public async installsTheBuiltArchivesWithEachPeerAtTheLockfilesVersionAfterThem(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PackageBuildTests.PROTOCOL),
      "package-lock.json": PackageBuildTests.LOCKFILE
    });
    const runner = new PackageToolsRunnerFixture(tree.path, {
      installedLockfile: JSON.stringify({ name: "app", lockfileVersion: 3, packages: { "node_modules/@angular/common": { version: "22.2.6" } } })
    });

    await PackageBuildTests.create(tree, runner).buildAsync(new PassThrough());

    Assert.areEqual(JSON.stringify([[PackageBuildTests.archive(PackageBuildTests.PROTOCOL), "@angular/common@22.2.6"]]), JSON.stringify(runner.installed));
  }

  @TestMethod
  public async namesEachPeerTheBuiltPackagesDeclareAtTheLockfilesVersionButNotABuiltPackage(): Promise<void> {
    const { PROTOCOL, RUNTIME } = PackageBuildTests;
    const lockfile = { name: "app", lockfileVersion: 3, packages: {
      "node_modules/@noldova/ui.components.angular": { version: "0.0.12" },
      "node_modules/@noldova/desktop.protocol": { version: "0.0.1" }
    } };
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PROTOCOL),
      ...PackageBuildTests.describePackage(RUNTIME, [PROTOCOL], { peerDependencies: { "@noldova/desktop.protocol": "__VERSION__", "@noldova/ui.components.angular": ">=0.0.5 <0.1.0" } }),
      "package-lock.json": JSON.stringify(lockfile)
    });
    const runner = new PackageToolsRunnerFixture(tree.path, { installedLockfile: JSON.stringify(lockfile) });

    await PackageBuildTests.create(tree, runner).buildAsync(new PassThrough());

    const last = runner.installed.at(-1) ?? [];
    Assert.isTrue(last.includes(PackageBuildTests.archive(RUNTIME)), JSON.stringify(runner.installed));
    Assert.isTrue(last.includes("@noldova/ui.components.angular@0.0.12"), JSON.stringify(runner.installed));
    Assert.isFalse(runner.installed.flat().includes("@noldova/desktop.protocol@0.0.1"), JSON.stringify(runner.installed));
  }

  @TestMethod
  public async failsTheBuildNamingAPackageTheInstallPutAtAVersionTheLockfileDoesNotHold(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PackageBuildTests.PROTOCOL),
      "package-lock.json": PackageBuildTests.LOCKFILE
    });
    const runner = new PackageToolsRunnerFixture(tree.path, {
      installedLockfile: JSON.stringify({ name: "app", lockfileVersion: 3, packages: { "node_modules/@angular/common": { version: "22.3.0" } } })
    });

    const error = await Assert.throwsAsync(() => PackageBuildTests.create(tree, runner).buildAsync(new PassThrough()), BuildException);

    Assert.areEqual(Resources.formatUnlockedInstall("node_modules/@angular/common", "22.3.0", "22.2.6"), error.message);
    Assert.areEqual(1, runner.installed.length);
  }

  @TestMethod
  public async namesEveryStaleArtifactUntilTheBuildRenewsIt(): Promise<void> {
    const { PROTOCOL, RUNTIME } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PROTOCOL),
      [`${PROTOCOL}/tests/tsconfig.json`]: "{}",
      [`${PROTOCOL}/tests/protocol.test.ts`]: "export {};\n",
      ...PackageBuildTests.describePackage(RUNTIME, [PROTOCOL])
    });
    const build = PackageBuildTests.create(tree, new PackageToolsRunnerFixture(tree.path));
    const protocol = PackageManifest.formatName(PROTOCOL);
    const runtime = PackageManifest.formatName(RUNTIME);
    await build.buildAsync(new PassThrough());

    await tree.writeAsync({ [`${PROTOCOL}/tests/protocol.test.ts`]: "export const changed = 1;\n" });
    const testsStale = await Assert.throwsAsync(() => build.requireCurrentAsync(), BuildException);
    await tree.writeAsync({ [`${PROTOCOL}/src/index.ts`]: "export const value = 2;\n" });
    const allStale = await Assert.throwsAsync(() => build.requireCurrentAsync(), BuildException);
    const rebuilt = await PackageBuildTests.collectAsync(t => build.buildAsync(t));
    await build.requireCurrentAsync();

    Assert.areEqual(Resources.formatArtifactsStale([`${protocol} tests`]), testsStale.message);
    Assert.areEqual(Resources.formatArtifactsStale([protocol, runtime, `${protocol} tests`]), allStale.message);
    Assert.areEqual(`${protocol}: built\n${runtime}: built\n${protocol} tests: compiled\n`, rebuilt);
  }

  @TestMethod
  public async buildsAndRequiresNothingInATreeWithoutPackages(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync(PackageBuildTests.BUILD_ROOT);
    const runner = new PackageToolsRunnerFixture(tree.path);
    const build = PackageBuildTests.create(tree, runner);

    await build.requireCurrentAsync();
    const output = await PackageBuildTests.collectAsync(t => build.buildAsync(t));

    Assert.areEqual(String.empty, output);
    Assert.areEqual(0, runner.calls.length);
  }

  @TestMethod
  public async typeChecksEachFixtureThatDoesNotBuildOnAnAngularPackage(): Promise<void> {
    const { PROTOCOL, FIXTURES } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PROTOCOL),
      ...PackageBuildTests.describePackage(PackageBuildTests.WINDOW, [PROTOCOL], PackageBuildTests.ANGULAR),
      ...PackageBuildTests.describePackage(`${FIXTURES}/runtime`, [PROTOCOL]),
      ...PackageBuildTests.describePackage(`${FIXTURES}/view`, [PackageBuildTests.WINDOW])
    });
    const runner = new PackageToolsRunnerFixture(tree.path);

    const output = await PackageBuildTests.collectAsync(t => PackageBuildTests.create(tree, runner).buildAsync(t));

    Assert.areEqual(`${PackageManifest.formatName(PROTOCOL)}: built\n${PackageManifest.formatName(`${FIXTURES}/runtime`)}: type-checked\n`
      + `${PackageManifest.formatName(`${FIXTURES}/view`)}: left to the test build, since it builds on an Angular package\n`, output);
    Assert.areEqual(JSON.stringify([`compile ${PROTOCOL}/src/tsconfig.json`, "pack noldova.desktop.protocol", "install", `type-check ${FIXTURES}/runtime/src/tsconfig.json`]),
      JSON.stringify(runner.calls));
  }

  @TestMethod
  public async buildsTheFixturesAmongThePackagesForTheTests(): Promise<void> {
    const { PROTOCOL, FIXTURES } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PROTOCOL),
      ...PackageBuildTests.describePackage(`${FIXTURES}/runtime`, [PROTOCOL])
    });
    const runner = new PackageToolsRunnerFixture(tree.path);

    const output = await PackageBuildTests.collectAsync(t => PackageBuildTests.create(tree, runner).buildAsync(t, PackageBuildTests.TEST));

    Assert.areEqual(`${PackageManifest.formatName(PROTOCOL)}: built\n${PackageManifest.formatName(`${FIXTURES}/runtime`)}: built\n`, output);
    Assert.areEqual(JSON.stringify([[PackageBuildTests.archive(PROTOCOL)], [PackageBuildTests.archive(`${FIXTURES}/runtime`), PackageBuildTests.archive(PROTOCOL)]]),
      JSON.stringify(runner.installs));
    Assert.isFalse(runner.calls.some(t => t.startsWith("type-check")), runner.calls.join("\n"));
  }

  @TestMethod
  public async buildsTheAngularPackagesThenThePackagesBuiltOnThemAndReusesThemWhileNothingChanged(): Promise<void> {
    const { PROTOCOL, RUNTIME, WINDOW, GALLERY, FIXTURES } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PROTOCOL),
      ...PackageBuildTests.describePackage(RUNTIME, [PROTOCOL]),
      ...PackageBuildTests.describePackage(WINDOW, [PROTOCOL], PackageBuildTests.ANGULAR),
      ...PackageBuildTests.describePackage(GALLERY, [WINDOW]),
      ...PackageBuildTests.describePackage(`${FIXTURES}/panel`, [WINDOW], PackageBuildTests.ANGULAR),
      ...PackageBuildTests.describePackage(`${FIXTURES}/window`, [WINDOW], PackageBuildTests.ANGULAR)
    });
    const runner = new PackageToolsRunnerFixture(tree.path);
    const build = PackageBuildTests.create(tree, runner);
    await build.buildAsync(new PassThrough(), PackageBuildTests.TEST);
    const earlier = runner.installs.length;
    const [window, panel, fixture, gallery] = [WINDOW, `${FIXTURES}/panel`, `${FIXTURES}/window`, GALLERY].map(t => PackageManifest.formatName(t));
    const [protocolArchive, runtimeArchive, windowArchive, galleryArchive] = [PROTOCOL, RUNTIME, WINDOW, GALLERY].map(t => PackageBuildTests.archive(t));

    const first = await PackageBuildTests.collectAsync(t => build.buildAngularAsync(t, PackageBuildTests.TEST));
    const second = await PackageBuildTests.collectAsync(t => build.buildAngularAsync(t, PackageBuildTests.TEST));

    Assert.areEqual(`${window}: built\n${panel}: built\n${fixture}: built\n${gallery}: built\nPackages built on Angular packages and installed: 1.\n`, first);
    Assert.areEqual(`${window}: reused\n${panel}: reused\n${fixture}: reused\n${gallery}: reused\nPackages built on Angular packages and installed: 1.\n`, second);
    Assert.areEqual(JSON.stringify([
      [protocolArchive, runtimeArchive, windowArchive],
      [protocolArchive, runtimeArchive, windowArchive],
      [galleryArchive, protocolArchive, runtimeArchive, windowArchive],
      [galleryArchive, protocolArchive, runtimeArchive, windowArchive]
    ]), JSON.stringify(runner.installs.slice(earlier)));
  }

  @TestMethod
  public async leavesThePackagesBuiltOnAngularOutOfTheFixturesInstallWhenAFixtureIsBuiltAgain(): Promise<void> {
    const { PROTOCOL, WINDOW, GALLERY, FIXTURES } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PROTOCOL),
      ...PackageBuildTests.describePackage(WINDOW, [PROTOCOL], PackageBuildTests.ANGULAR),
      ...PackageBuildTests.describePackage(GALLERY, [WINDOW]),
      ...PackageBuildTests.describePackage(`${FIXTURES}/window`, [WINDOW], PackageBuildTests.ANGULAR)
    });
    const runner = new PackageToolsRunnerFixture(tree.path);
    const build = PackageBuildTests.create(tree, runner);
    await build.buildAsync(new PassThrough(), PackageBuildTests.TEST);
    await build.buildAngularAsync(new PassThrough(), PackageBuildTests.TEST);
    const earlier = runner.installs.length;

    await tree.writeAsync({ [`${FIXTURES}/window/src/index.ts`]: "export const value = 2;\n" });
    await build.buildAngularAsync(new PassThrough(), PackageBuildTests.TEST);

    Assert.areEqual(JSON.stringify([PROTOCOL, WINDOW].map(t => PackageBuildTests.archive(t)).sort()), JSON.stringify(runner.installs[earlier]));
  }

  @TestMethod
  public async buildsAnAngularPackageAgainWhenTheWindowAppOrTheCarryScriptChanges(): Promise<void> {
    const { PROTOCOL, WINDOW } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.WINDOW_APP,
      ...PackageBuildTests.describePackage(PROTOCOL),
      ...PackageBuildTests.describePackage(WINDOW, [PROTOCOL], PackageBuildTests.ANGULAR)
    });
    const build = PackageBuildTests.create(tree, new PackageToolsRunnerFixture(tree.path));
    await build.buildAsync(new PassThrough());
    const outputs: string[] = [];

    outputs.push(await PackageBuildTests.collectAsync(t => build.buildAngularAsync(t)));
    outputs.push(await PackageBuildTests.collectAsync(t => build.buildAngularAsync(t)));
    await tree.writeAsync({ "src/app.window.app/tsconfig.json": "{\"compilerOptions\":{\"strict\":true}}" });
    outputs.push(await PackageBuildTests.collectAsync(t => build.buildAngularAsync(t)));
    await tree.writeAsync({ "scripts/carry-docs.ts": "export {};\n" });
    outputs.push(await PackageBuildTests.collectAsync(t => build.buildAngularAsync(t)));
    outputs.push(await PackageBuildTests.collectAsync(t => build.buildAngularAsync(t)));

    const window = PackageManifest.formatName(WINDOW);
    Assert.areEqual(JSON.stringify([`${window}: built\n`, `${window}: reused\n`, `${window}: built\n`, `${window}: built\n`, `${window}: reused\n`]), JSON.stringify(outputs));
  }

  @TestMethod
  public async readsTheCheckoutForAWindowAppWithoutAngularPackagesAndNothingWithoutOne(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ ...PackageBuildTests.BUILD_ROOT, ...PackageBuildTests.describePackage(PackageBuildTests.PROTOCOL), ".git/HEAD": "ref: refs/heads/main\n" });
    const runner = new PackageToolsRunnerFixture(tree.path);
    const build = PackageBuildTests.create(tree, runner);

    const withoutApp = await build.buildAngularAsync(new PassThrough());
    await tree.writeAsync({ "src/app.window.app/package.json": JSON.stringify({ name: "app-window", private: true }) });
    const withoutWorkspace = await build.buildAngularAsync(new PassThrough());
    const callsWithoutApp = runner.calls.length;
    await tree.writeAsync(PackageBuildTests.WINDOW_APP);
    const output = await PackageBuildTests.collectAsync(t => build.buildAngularAsync(t));

    Assert.areEqual(0, withoutApp.length + withoutWorkspace.length);
    Assert.areEqual(0, callsWithoutApp);
    Assert.areEqual(String.empty, output);
    Assert.areEqual(JSON.stringify(["git status --porcelain", "git rev-parse --verify --quiet HEAD"]), JSON.stringify(runner.calls));
  }

  @TestMethod
  public async stampsTheCommitOfACleanCheckoutIntoEachPackage(): Promise<void> {
    const manifest = await PackageBuildTests.buildInCheckoutAsync({ commit: "abc123\n" });

    Assert.areEqual("abc123", manifest.readString("gitHead"));
  }

  @TestMethod
  public async stampsNoCommitIntoAPackageBuiltFromAChangedCheckout(): Promise<void> {
    const manifest = await PackageBuildTests.buildInCheckoutAsync({ status: " M src/noldova.desktop.protocol/src/index.ts\n", commit: "abc123\n" });

    Assert.isFalse(manifest.hasField("gitHead"));
  }

  @TestMethod
  public async stampsNoCommitIntoAPackageBuiltFromACheckoutWithoutOne(): Promise<void> {
    const manifest = await PackageBuildTests.buildInCheckoutAsync({ commit: String.empty });

    Assert.isFalse(manifest.hasField("gitHead"));
  }

  @TestMethod
  public async buildsAPackageAgainWhenTheReleaseAddonsChange(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PackageBuildTests.PROTOCOL),
      "addons/notes.txt": "first\n"
    });
    const build = PackageBuildTests.create(tree, new PackageToolsRunnerFixture(tree.path), { RELEASE_ADDONS: path.join(tree.path, "addons") });
    const outputs: string[] = [];

    outputs.push(await PackageBuildTests.collectAsync(t => build.buildAsync(t)));
    outputs.push(await PackageBuildTests.collectAsync(t => build.buildAsync(t)));
    await tree.writeAsync({ "addons/notes.txt": "second\n" });
    outputs.push(await PackageBuildTests.collectAsync(t => build.buildAsync(t)));

    const protocol = PackageManifest.formatName(PackageBuildTests.PROTOCOL);
    Assert.areEqual(JSON.stringify([`${protocol}: built\n`, `${protocol}: reused\n`, `${protocol}: built\n`]), JSON.stringify(outputs));
  }

  @TestMethod
  public async changesTheFingerprintWithTheSourceOfAPackage(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ ...PackageBuildTests.BUILD_ROOT, ...PackageBuildTests.describePackage(PackageBuildTests.PROTOCOL) });
    const build = PackageBuildTests.create(tree, new PackageToolsRunnerFixture(tree.path));

    const first = await build.hashFingerprintAsync(BuildVariant.REGULAR);
    const again = await build.hashFingerprintAsync(BuildVariant.REGULAR);
    await tree.writeAsync({ [`${PackageBuildTests.PROTOCOL}/src/index.ts`]: "export const value = 2;\n" });
    const changed = await build.hashFingerprintAsync(BuildVariant.REGULAR);

    Assert.areEqual(first, again);
    Assert.areNotEqual(first, changed);
  }

  @TestMethod
  public async buildsAPackageWithItsBuildScriptAndAgainWhenAnInputItListsChanges(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ ...PackageBuildTests.BUILD_ROOT, ...PackageBuildTests.describeScripted(), "shared/fonts/face.woff2": "font\n" });
    const runner = new PackageToolsRunnerFixture(tree.path, { inputs: "shared/fonts\n" });
    const build = PackageBuildTests.create(tree, runner);
    const styles = PackageManifest.formatName(PackageBuildTests.STYLES);
    const installed = path.join(tree.path, "node_modules", ...styles.split("/"), "fonts", "face.woff2");

    const first = await PackageBuildTests.collectAsync(t => build.buildAsync(t));
    const calls = [...runner.calls];
    const firstFont = await readFile(installed, "utf8");
    await tree.writeAsync({ "shared/fonts/face.woff2": "font 2\n" });
    const second = await PackageBuildTests.collectAsync(t => build.buildAsync(t));

    Assert.areEqual(`${styles}: built\n`, first);
    Assert.areEqual(`${styles}: built\n`, second);
    const { SCRIPT } = PackageBuildTests;
    Assert.areEqual(JSON.stringify([`inputs ${SCRIPT}`, `build ${SCRIPT}`, "pack noldova.desktop.styles", `inputs ${SCRIPT}`, "install", `inputs ${SCRIPT}`]), JSON.stringify(calls));
    Assert.areEqual("font\n", firstFont);
    Assert.areEqual("font 2\n", await readFile(installed, "utf8"));
    Assert.isFalse(existsSync(path.join(tree.path, "_build", "packages", "noldova.desktop.styles", "api")));
  }

  @TestMethod
  public async buildsAPackageWhoseBuildScriptListsNoInputs(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ ...PackageBuildTests.BUILD_ROOT, ...PackageBuildTests.describeScripted() });
    const styles = PackageManifest.formatName(PackageBuildTests.STYLES);

    const output = await PackageBuildTests.collectAsync(t => PackageBuildTests.create(tree, new PackageToolsRunnerFixture(tree.path)).buildAsync(t));

    Assert.areEqual(`${styles}: built\n`, output);
    Assert.areEqual("built\n", await readFile(path.join(tree.path, "node_modules", ...styles.split("/"), "index.js"), "utf8"));
  }

  @TestMethod
  public async refusesAnArchiveWhoseCopiesDifferFromOrLackTheInputsTheBuildScriptLists(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describeScripted(),
      "shared/fonts/face.woff2": "font\n",
      "shared/mark.svg": "<svg/>\n"
    });
    const runner = new PackageToolsRunnerFixture(tree.path, { inputs: "shared/fonts\nshared/mark.svg\n", scriptFiles: { "index.js": "built\n", "fonts/face.woff2": "changed\n" } });
    const archive = PackageBuildTests.archive(PackageBuildTests.STYLES);

    const error = await Assert.throwsAsync(() => PackageBuildTests.create(tree, runner).buildAsync(new PassThrough()), BuildException);

    Assert.areEqual([
      `${archive} holds a package/fonts/face.woff2 that differs from shared/fonts/face.woff2.`,
      `${archive} lacks package/mark.svg, the copy of shared/mark.svg.`,
      Resources.buildScriptInputsRule
    ].join("\n"), error.message);
    Assert.isFalse(runner.calls.includes("install"), runner.calls.join("\n"));
  }

  @TestMethod
  public async reportsACompileThatFails(): Promise<void> {
    const message = await PackageBuildTests.failAsync(`compile ${PackageBuildTests.PROTOCOL}/src`, false);

    Assert.areEqual(`Compiling ${PackageBuildTests.PROTOCOL}/src failed with exit code 1:\nbroken`, message);
  }

  @TestMethod
  public async reportsAPackThatFails(): Promise<void> {
    const message = await PackageBuildTests.failAsync("pack", false);

    Assert.areEqual(`Packing ${PackageManifest.formatName(PackageBuildTests.PROTOCOL)} failed with exit code 1:\nbroken`, message);
  }

  @TestMethod
  public async reportsAnInstallThatFails(): Promise<void> {
    const message = await PackageBuildTests.failAsync("install", false);

    Assert.areEqual(`Installing ${PackageManifest.formatName(PackageBuildTests.PROTOCOL)} failed with exit code 1:\nbroken`, message);
  }

  @TestMethod
  public async reportsATestCompileThatFails(): Promise<void> {
    const message = await PackageBuildTests.failAsync(`compile ${PackageBuildTests.PROTOCOL}/tests`, false);

    Assert.areEqual(`Compiling ${PackageBuildTests.PROTOCOL}/tests failed with exit code 1:\nbroken`, message);
  }

  @TestMethod
  public async reportsATypeCheckThatFails(): Promise<void> {
    const message = await PackageBuildTests.failAsync("type-check", false);

    Assert.areEqual(`Type-checking ${PackageBuildTests.FIXTURES}/runtime/src failed with exit code 1:\nbroken`, message);
  }

  @TestMethod
  public async reportsABuildScriptThatFails(): Promise<void> {
    const message = await PackageBuildTests.failAsync("build ", true);

    Assert.areEqual(`Building ${PackageBuildTests.STYLES} with its scripts/build.ts failed with exit code 1:\nbroken`, message);
  }

  @TestMethod
  public async reportsABuildScriptThatFailsToListItsInputs(): Promise<void> {
    const message = await PackageBuildTests.failAsync("inputs ", true);

    Assert.areEqual(`Listing the inputs of ${PackageBuildTests.STYLES} with its scripts/build.ts failed with exit code 1:\nbroken`, message);
  }

  @TestMethod
  public async refusesAProtocolVersionPlaceholderWhenTheRootDeclaresNoProtocolVersion(): Promise<void> {
    const { PROTOCOL } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      "package.json": JSON.stringify({ name: "app", version: PackageBuildTests.VERSION, desktop: { modules: [] } }),
      ...PackageBuildTests.describePackage(PROTOCOL),
      [`${PROTOCOL}/src/resources.ts`]: "export const protocolVersion = __PROTOCOL_VERSION__;\n"
    });

    const error = await Assert.throwsAsync(() => PackageBuildTests.create(tree, new PackageToolsRunnerFixture(tree.path)).buildAsync(new PassThrough()), BuildException);

    Assert.areEqual(`${PROTOCOL} uses __PROTOCOL_VERSION__, but the root package.json declares no desktop.protocolVersion.`, error.message);
  }

  @TestMethod
  public async installsTheAngularPackagesWithEveryOtherPackageThenReusesTheInstall(): Promise<void> {
    await using tree = await PackageBuildTests.createAngularTreeAsync();
    const runner = new PackageToolsRunnerFixture(tree.path);
    const build = PackageBuildTests.create(tree, runner);
    await build.buildAsync(new PassThrough());
    await build.buildAngularAsync(new PassThrough());
    const earlier = runner.installs.length;

    const first = await PackageBuildTests.collectAsync(t => build.installAngularAsync(t));
    const second = await PackageBuildTests.collectAsync(t => build.installAngularAsync(t));

    Assert.areEqual(PackageBuildTests.INSTALLED, first);
    Assert.areEqual(PackageBuildTests.REUSED_INSTALL, second);
    Assert.areEqual(JSON.stringify([[PackageBuildTests.GALLERY, PackageBuildTests.PROTOCOL, PackageBuildTests.RUNTIME, PackageBuildTests.WINDOW].map(t => PackageBuildTests.archive(t))]),
      JSON.stringify(runner.installs.slice(earlier)));
    Assert.isTrue(existsSync(path.join(tree.path, "_build", "records", "window-install.txt")));
  }

  @TestMethod
  public async installsAgainWhenAnInstalledAngularPackageChangedOrWentMissing(): Promise<void> {
    await using tree = await PackageBuildTests.createAngularTreeAsync();
    const runner = new PackageToolsRunnerFixture(tree.path);
    const build = PackageBuildTests.create(tree, runner);
    const window = PackageManifest.formatName(PackageBuildTests.WINDOW);
    await build.buildAsync(new PassThrough());
    await build.buildAngularAsync(new PassThrough());
    await build.installAngularAsync(new PassThrough());
    const earlier = runner.installs.length;
    const outputs: string[] = [];

    await tree.writeAsync({ [`node_modules/${window}/package.json`]: JSON.stringify({ name: window, version: "0.0.1" }) });
    outputs.push(await PackageBuildTests.collectAsync(t => build.installAngularAsync(t)));
    await rm(path.join(tree.path, "node_modules", ...window.split("/")), { recursive: true, force: true });
    outputs.push(await PackageBuildTests.collectAsync(t => build.installAngularAsync(t)));
    outputs.push(await PackageBuildTests.collectAsync(t => build.installAngularAsync(t)));

    Assert.areEqual(JSON.stringify([PackageBuildTests.INSTALLED, PackageBuildTests.INSTALLED, PackageBuildTests.REUSED_INSTALL]), JSON.stringify(outputs));
    Assert.areEqual(earlier + 2, runner.installs.length);
    Assert.areEqual(PackageBuildTests.VERSION, JsonReader.parse(await readFile(path.join(tree.path, "node_modules", ...window.split("/"), "package.json"), "utf8")).readString("version"));
  }

  @TestMethod
  public async installsOnlyTheArchivesBuiltSoFarWhenAnAngularPackageHasNone(): Promise<void> {
    const { PROTOCOL, WINDOW } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PROTOCOL),
      ...PackageBuildTests.describePackage(WINDOW, [PROTOCOL], PackageBuildTests.ANGULAR)
    });
    const runner = new PackageToolsRunnerFixture(tree.path);
    const build = PackageBuildTests.create(tree, runner);
    await build.buildAsync(new PassThrough());
    const earlier = runner.installs.length;

    const first = await PackageBuildTests.collectAsync(t => build.installAngularAsync(t));
    const second = await PackageBuildTests.collectAsync(t => build.installAngularAsync(t));

    Assert.areEqual(PackageBuildTests.INSTALLED, first);
    Assert.areEqual(PackageBuildTests.REUSED_INSTALL, second);
    Assert.areEqual(JSON.stringify([[PackageBuildTests.archive(PROTOCOL)]]), JSON.stringify(runner.installs.slice(earlier)));
  }

  @TestMethod
  public async checksTheInstalledTreeOfAnAppWithoutAngularPackagesOrAWindowApp(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      "node_modules/@angular/core/package.json": JSON.stringify({ name: "@angular/core", version: "22.0.0" })
    });
    const runner = new PackageToolsRunnerFixture(tree.path);
    const build = PackageBuildTests.create(tree, runner);

    const output = await PackageBuildTests.collectAsync(t => build.installAngularAsync(t));
    await tree.writeAsync({ "node_modules/sample/node_modules/@angular/core/package.json": JSON.stringify({ name: "@angular/core", version: "22.0.1" }) });
    const error = await Assert.throwsAsync(() => build.installAngularAsync(new PassThrough()), BuildException);

    Assert.areEqual(String.empty, output);
    Assert.areEqual(Resources.formatSecondCopy("@angular/core", "node_modules/sample/node_modules/@angular/core"), error.message);
    Assert.areEqual(0, runner.calls.length);
  }

  private static describePackage(directory: string, dependencies: readonly string[] = [], fields: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, string>> {
    return {
      [`${directory}/package.json`]: JSON.stringify({
        name: PackageManifest.formatName(directory),
        version: "__VERSION__",
        dependencies: Object.fromEntries(dependencies.map(t => [PackageManifest.formatName(t), "__VERSION__"])),
        ...fields
      }),
      [`${directory}/src/api/index.d.ts`]: "export {};\n",
      [`${directory}/src/index.ts`]: "export const value = 1;\n"
    };
  }

  private static describeScripted(): Readonly<Record<string, string>> {
    return { ...PackageBuildTests.describePackage(PackageBuildTests.STYLES), [PackageBuildTests.SCRIPT]: "export {};\n" };
  }

  private static archive(directory: string): string {
    return BuildLayout.nameArchive(PackageManifest.formatName(directory), PackageBuildTests.VERSION);
  }

  private static create(tree: SourceTreeFixture, runner: PackageToolsRunnerFixture, environment: NodeJS.ProcessEnv = {}): PackageBuild {
    return new PackageBuild(tree.path, runner, { ...runner.environment, ...environment }, "linux", "x64");
  }

  private static async createAngularTreeAsync(): Promise<SourceTreeFixture> {
    const { PROTOCOL, RUNTIME, WINDOW, GALLERY } = PackageBuildTests;
    return await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PROTOCOL),
      ...PackageBuildTests.describePackage(RUNTIME, [PROTOCOL]),
      ...PackageBuildTests.describePackage(WINDOW, [PROTOCOL], PackageBuildTests.ANGULAR),
      ...PackageBuildTests.describePackage(GALLERY, [WINDOW])
    });
  }

  private static async collectAsync(run: (output: Writable) => Promise<unknown>): Promise<string> {
    const chunks: string[] = [];
    const output = new Writable({
      write: (chunk: Buffer, _encoding, callback): void => {
        chunks.push(chunk.toString());
        callback();
      }
    });
    await run(output);
    return chunks.join(String.empty);
  }

  private static async readBuiltAsync(tree: SourceTreeFixture, directory: string, file: string): Promise<string> {
    return await readFile(path.join(tree.path, "_build", "packages", directory.slice("src/".length), ...file.split("/")), "utf8");
  }

  private static async buildInCheckoutAsync(answers: IPackageToolsAnswers): Promise<JsonReader> {
    await using tree = await SourceTreeFixture.createAsync({
      ...PackageBuildTests.BUILD_ROOT,
      ...PackageBuildTests.describePackage(PackageBuildTests.PROTOCOL),
      ".git/HEAD": "ref: refs/heads/main\n"
    });
    await PackageBuildTests.create(tree, new PackageToolsRunnerFixture(tree.path, answers)).buildAsync(new PassThrough());
    return JsonReader.parse(await PackageBuildTests.readBuiltAsync(tree, PackageBuildTests.PROTOCOL, "package.json"));
  }

  private static async failAsync(failing: string, isScripted: boolean): Promise<string> {
    const { PROTOCOL, FIXTURES } = PackageBuildTests;
    await using tree = await SourceTreeFixture.createAsync(isScripted
      ? { ...PackageBuildTests.BUILD_ROOT, ...PackageBuildTests.describeScripted() }
      : {
        ...PackageBuildTests.BUILD_ROOT,
        ...PackageBuildTests.describePackage(PROTOCOL),
        [`${PROTOCOL}/tests/tsconfig.json`]: "{}",
        [`${PROTOCOL}/tests/protocol.test.ts`]: "export {};\n",
        ...PackageBuildTests.describePackage(`${FIXTURES}/runtime`, [PROTOCOL])
      });
    const runner = new PackageToolsRunnerFixture(tree.path, { failing });
    return (await Assert.throwsAsync(() => PackageBuildTests.create(tree, runner).buildAsync(new PassThrough()), BuildException)).message;
  }

  private static async runAsync(tree: SourceTreeFixture, commandArguments: readonly string[]): Promise<readonly [number, string]> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    const exitCode = await new BuildCommandLine(tree.path, {}, process.platform, process.arch, output, new PassThrough()).runAsync(commandArguments);
    return [exitCode, chunks.join(String.empty)];
  }
}
