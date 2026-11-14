/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageManifest } from "../../../src/models/packages/package-manifest.js";
import { Resources } from "../../../src/resources.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class PackageManifestTests {
  private static readonly DIRECTORY: string = `${Resources.moduleFixtureFolder}/notes/runtime`;
  private static readonly SOURCE: string = "src/noldova.desktop.protocol";
  private static readonly FILE: string = `${PackageManifestTests.SOURCE}/package.json`;
  private static readonly NAME: string = "@noldova/desktop.protocol";

  @TestMethod
  public namesAFixtureModulesPackageForItsPathBelowTheFixtureFolder(): void {
    const fixture = new PackageManifest(PackageManifestTests.DIRECTORY, "@noldova/desktop.fixture.notes.runtime", []);

    Assert.isTrue(fixture.isFixture);
    Assert.areEqual("fixture-notes-runtime", fixture.id);
  }

  @TestMethod
  public marksAPackageDirectlyUnderSrcAsNotAFixture(): void {
    Assert.isFalse(new PackageManifest("src/noldova.desktop.protocol", "@noldova/desktop.protocol", []).isFixture);
  }

  @TestMethod
  public refusesAFixtureModulesPackageNamedForAnotherPath(): void {
    const error = Assert.throws(() => new PackageManifest(PackageManifestTests.DIRECTORY, "@noldova/desktop.electron.tests.e2e.fixtures.modules.notes.runtime", []), BuildException);

    Assert.areEqual(
      `${PackageManifestTests.DIRECTORY}/package.json must be named "@noldova/desktop.fixture.notes.runtime", the fixture package's path below ${Resources.moduleFixtureFolder}/ joined with dots.`,
      error.message);
  }

  @TestMethod
  public refusesASourcePackageNamedForAnotherFolder(): void {
    const error = Assert.throws(() => new PackageManifest(PackageManifestTests.SOURCE, "@noldova/desktop.other", []), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} must be named "${PackageManifestTests.NAME}", the name its folder gives.`, error.message);
  }

  @TestMethod
  public async readsEveryFieldOfAManifestAsync(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      [PackageManifestTests.FILE]: JSON.stringify({
        name: PackageManifestTests.NAME,
        version: "__VERSION__",
        dependencies: { "left-pad": "1.3.0", "@noldova/desktop.runtime": "__VERSION__", "@noldova/desktop": "__VERSION__" },
        peerDependencies: { "@angular/core": "^20.0.0", "@noldova/desktop.runtime": "__VERSION__", "react": "^18.0.0", "vue": "^3.0.0" },
        peerDependenciesMeta: { react: { optional: true }, vue: { optional: false }, "@angular/core": {} },
        noldova: { coverageExclusions: ["src/generated.ts"], windowsAddons: ["pty-host"], posixAddons: ["pty", "pty-spawn"] },
        files: ["dist", "README.md"]
      })
    });

    const manifest = await PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE);

    Assert.areEqual(PackageManifestTests.SOURCE, manifest.directory);
    Assert.areEqual(PackageManifestTests.NAME, manifest.name);
    Assert.areEqual("@noldova/desktop,@noldova/desktop.runtime", manifest.dependencies.join());
    Assert.areEqual("[\"src/generated.ts\"]", manifest.coverageExclusions);
    Assert.areEqual("@angular/core,@noldova/desktop.runtime,react,vue", manifest.peerDependencies.join());
    Assert.areEqual("react", manifest.optionalPeers.join());
    Assert.isTrue(manifest.isAngular);
    Assert.areEqual("pty-host", manifest.windowsAddons.join());
    Assert.areEqual("pty,pty-spawn", manifest.posixAddons.join());
    Assert.areEqual("left-pad=1.3.0", [...manifest.externalDependencies].map(([name, version]) => `${name}=${version}`).join());
    Assert.areEqual("dist,README.md", (manifest.files ?? []).join());
    Assert.areEqual("noldova.desktop.protocol", manifest.id);
  }

  @TestMethod
  public async takesNoDependenciesNoSettingsAndNoFilesWhenTheManifestListsNoneAsync(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ [PackageManifestTests.FILE]: JSON.stringify({ name: PackageManifestTests.NAME, version: "__VERSION__" }) });

    const manifest = await PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE);

    Assert.areEqual(0, manifest.dependencies.length);
    Assert.areEqual(0, manifest.peerDependencies.length);
    Assert.areEqual(0, manifest.optionalPeers.length);
    Assert.isFalse(manifest.isAngular);
    Assert.areEqual(Resources.packageNoCoverageExclusions, manifest.coverageExclusions);
    Assert.areEqual(0, manifest.windowsAddons.length);
    Assert.areEqual(0, manifest.posixAddons.length);
    Assert.areEqual(0, manifest.externalDependencies.size);
    Assert.isNull(manifest.files);
  }

  @TestMethod
  public async refusesAManifestThatIsMissingAsync(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} could not be read as JSON.`, error.message);
  }

  @TestMethod
  @TestData("{\"name\":\"@noldova/desktop.protocol\",")
  @TestData("not JSON")
  public async refusesAManifestThatIsNotJsonAsync(text: string): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ [PackageManifestTests.FILE]: text });

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} could not be read as JSON.`, error.message);
  }

  @TestMethod
  @TestData("{\"version\":\"__VERSION__\"}")
  @TestData("{\"name\":1,\"version\":\"__VERSION__\"}")
  public async refusesAManifestWithoutANameAsync(text: string): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ [PackageManifestTests.FILE]: text });

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} must have a name.`, error.message);
  }

  @TestMethod
  @TestData("{\"name\":\"@noldova/desktop.protocol\"}")
  @TestData("{\"name\":\"@noldova/desktop.protocol\",\"version\":\"1.0.0\"}")
  public async refusesAManifestWhoseVersionIsNotThePlaceholderAsync(text: string): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ [PackageManifestTests.FILE]: text });

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(Resources.formatManifestVersionUnstamped(PackageManifestTests.FILE), error.message);
  }

  @TestMethod
  @TestData("[]")
  @TestData("\"left-pad\"")
  public async refusesDependenciesThatAreNotAnObjectAsync(dependencies: string): Promise<void> {
    await using tree = await PackageManifestTests.createAsync(`"dependencies":${dependencies}`);

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} must list its dependencies as an object.`, error.message);
  }

  @TestMethod
  @TestData("[]")
  @TestData("1")
  public async refusesPeerDependenciesThatAreNotAnObjectAsync(peers: string): Promise<void> {
    await using tree = await PackageManifestTests.createAsync(`"peerDependencies":${peers}`);

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} must list its peer dependencies as an object.`, error.message);
  }

  @TestMethod
  @TestData("[]")
  @TestData("1")
  @TestData("{\"react\":\"optional\"}")
  @TestData("{\"react\":{\"optional\":\"yes\"}}")
  public async refusesAPeerDependenciesMetaThatIsNotAnObjectOfObjectsWithABooleanOptionalAsync(meta: string): Promise<void> {
    await using tree = await PackageManifestTests.createAsync(`"peerDependenciesMeta":${meta}`);

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} must describe each peer dependency in peerDependenciesMeta as an object, with optional, when given, true or false.`, error.message);
  }

  @TestMethod
  public async refusesAThirdPartyDependencyWithoutAnExactVersionAsync(): Promise<void> {
    await using tree = await PackageManifestTests.createAsync("\"dependencies\":{\"left-pad\":1,\"right-pad\":\"1.0.0\",\"top-pad\":null}");

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(Resources.formatManifestUnpinned(PackageManifestTests.FILE, ["left-pad", "top-pad"]), error.message);
  }

  @TestMethod
  public async refusesAnOwnDependencyOrPeerNotAtThePlaceholderAsync(): Promise<void> {
    await using tree = await PackageManifestTests.createAsync(
      "\"dependencies\":{\"@noldova/desktop.runtime\":\"1.0.0\",\"@noldova/desktop.window\":\"__VERSION__\"},\"peerDependencies\":{\"@noldova/desktop\":\"^1.0.0\"}");

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(Resources.formatManifestOwnUnstamped(PackageManifestTests.FILE, ["@noldova/desktop.runtime", "@noldova/desktop"]), error.message);
  }

  @TestMethod
  @TestData("[]")
  @TestData("1")
  @TestData("null")
  public async refusesNoldovaSettingsThatAreNotAnObjectAsync(settings: string): Promise<void> {
    await using tree = await PackageManifestTests.createAsync(`"noldova":${settings}`);

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} must keep its noldova settings in an object.`, error.message);
  }

  @TestMethod
  @TestData("{}")
  @TestData("\"src/generated.ts\"")
  public async refusesCoverageExclusionsThatAreNotAnArrayAsync(exclusions: string): Promise<void> {
    await using tree = await PackageManifestTests.createAsync(`"noldova":{"coverageExclusions":${exclusions}}`);

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} must list its coverage exclusions in an array.`, error.message);
  }

  @TestMethod
  @TestData("windowsAddons", "\"pty\"", "Windows")
  @TestData("windowsAddons", "[1]", "Windows")
  @TestData("windowsAddons", "[\"Pty_Host\"]", "Windows")
  @TestData("posixAddons", "{}", "POSIX")
  @TestData("posixAddons", "[\"pty\",\"-pty\"]", "POSIX")
  public async refusesAddonsThatAreNotAnArrayOfKebabCaseNamesAsync(field: string, addons: string, kind: string): Promise<void> {
    await using tree = await PackageManifestTests.createAsync(`"noldova":{"${field}":${addons}}`);

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} must list its ${kind} addons in an array of kebab-case names.`, error.message);
  }

  @TestMethod
  @TestData("\"dist\"")
  @TestData("{}")
  @TestData("[\"dist\",1]")
  public async refusesFilesThatAreNotAnArrayOfPatternsAsync(files: string): Promise<void> {
    await using tree = await PackageManifestTests.createAsync(`"files":${files}`);

    const error = await Assert.throwsAsync(() => PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE), BuildException);

    Assert.areEqual(`${PackageManifestTests.FILE} must list its files in an array of patterns.`, error.message);
  }

  @TestMethod
  public async takesNoFilesWhenTheManifestListsThemAsNullAsync(): Promise<void> {
    await using tree = await PackageManifestTests.createAsync("\"files\":null");

    Assert.isNull((await PackageManifest.readAsync(tree.path, PackageManifestTests.SOURCE)).files);
  }

  @TestMethod
  public async namesItsOwnPackagesFromTheAppsPrefixAsync(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modulePackagePrefix: "@example/app." } }),
      "src/modules/notes/runtime/package.json": JSON.stringify({ name: "@example/app.notes.runtime", version: "__VERSION__", dependencies: { "@example/app.notes.core": "__VERSION__", "left-pad": "1.3.0" } })
    });

    const manifest = await PackageManifest.readAsync(tree.path, "src/modules/notes/runtime");

    Assert.areEqual("@example/app.notes.runtime", manifest.name);
    Assert.areEqual("@example/app.notes.core", manifest.dependencies.join());
    Assert.areEqual("left-pad", [...manifest.externalDependencies.keys()].join());
  }

  private static createAsync(fields: string): Promise<SourceTreeFixture> {
    return SourceTreeFixture.createAsync({ [PackageManifestTests.FILE]: `{"name":"${PackageManifestTests.NAME}","version":"__VERSION__",${fields}}` });
  }
}
