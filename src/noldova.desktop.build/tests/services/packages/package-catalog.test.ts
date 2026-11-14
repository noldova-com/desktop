/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rm } from "node:fs/promises";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageManifest } from "../../../src/models/packages/package-manifest.js";
import { Resources } from "../../../src/resources.js";
import { PackageCatalog } from "../../../src/services/packages/package-catalog.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class PackageCatalogTests {
  private static readonly PROTOCOL: string = "src/noldova.desktop.protocol";
  private static readonly PROTOCOL_NAME: string = "@noldova/desktop.protocol";
  private static readonly FIXTURE: string = `${Resources.moduleFixtureFolder}/notes/runtime`;
  private static readonly FIXTURE_NAME: string = "@noldova/desktop.fixture.notes.runtime";
  private static readonly VERSION: string = "__VERSION__";

  @TestMethod
  public async listsNoPackagesInATreeWithoutASourceFolderOrManifests(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();
    Assert.areEqual(0, (await new PackageCatalog(tree.path).listPackagesAsync()).length);

    await tree.writeAsync({ "src/modules/drafts/README.md": "# Drafts\n", "package.json": "{}\n" });

    Assert.areEqual(0, (await new PackageCatalog(tree.path).listPackagesAsync()).length);
  }

  @TestMethod
  public async putsAPackageAfterThePackagesItDependsOnInLayersAndInPathOrderWithinALayerOutsideInstalledDependenciesAndTheAngularProjectsManifest(): Promise<void> {
    await using tree = await PackageCatalogTests.createPackagesAsync({
      "src/noldova.desktop.cli": ["src/noldova.desktop.runtime"],
      "src/noldova.desktop.electron": ["src/noldova.desktop.protocol", "src/noldova.desktop.runtime"],
      "src/noldova.desktop.protocol": [],
      "src/noldova.desktop.runtime": ["src/noldova.desktop.protocol"],
      "src/modules/terminal/window": ["src/noldova.desktop.protocol"]
    });
    await tree.writeAsync({
      "src/noldova.desktop.window.app/package.json": JSON.stringify({ name: "@noldova/desktop.window.app", private: true }),
      "package-lock.json": "{}",
      "node_modules/@angular/core/package.json": "{}",
      "src/noldova.desktop.cli/node_modules/dependency/package.json": "{}",
      "src/noldova.desktop.cli/src/package-notes.json": "{}"
    });

    const packages = await new PackageCatalog(tree.path).listPackagesAsync();

    Assert.areEqual(
      "src/noldova.desktop.protocol, src/modules/terminal/window, src/noldova.desktop.runtime, src/noldova.desktop.cli, src/noldova.desktop.electron",
      packages.map(t => t.directory).join(", "));
  }

  @TestMethod
  public async listsAPackageWithAPeerOnAngularsCoreApartFromTheNodePackages(): Promise<void> {
    await using tree = await PackageCatalogTests.createPackagesAsync({
      "src/noldova.desktop.protocol": [],
      "src/noldova.desktop.runtime": ["src/noldova.desktop.protocol"]
    });
    await tree.writeAsync({
      "src/noldova.desktop.window/package.json": JSON.stringify({
        name: "@noldova/desktop.window",
        version: PackageCatalogTests.VERSION,
        dependencies: { "@noldova/desktop.runtime": PackageCatalogTests.VERSION },
        peerDependencies: { "@angular/core": "22.2.1", rxjs: "7.8.2" }
      }),
      "src/noldova.desktop.electron/package.json": JSON.stringify({
        name: "@noldova/desktop.electron",
        version: PackageCatalogTests.VERSION,
        dependencies: { "@noldova/desktop.protocol": PackageCatalogTests.VERSION },
        peerDependencies: { electron: "44.5.1" }
      })
    });
    const catalog = new PackageCatalog(tree.path);

    const angular = await catalog.listAngularPackagesAsync();

    Assert.areEqual("src/noldova.desktop.protocol, src/noldova.desktop.electron, src/noldova.desktop.runtime", (await catalog.listPackagesAsync()).map(t => t.directory).join(", "));
    Assert.areEqual("src/noldova.desktop.window", angular.map(t => t.directory).join(", "));
    Assert.isTrue(angular.every(t => t.isAngular));
    Assert.areEqual("@angular/core,rxjs", angular[0]?.peerDependencies.join(","));
  }

  @TestMethod
  public async refusesPackagesWhosePathsProduceTheSameName(): Promise<void> {
    await using tree = await PackageCatalogTests.createPackagesAsync({ "src/noldova.desktop.notes.runtime": [], "src/modules/notes/runtime": [] });

    const error = await Assert.throwsAsync(() => new PackageCatalog(tree.path).listPackagesAsync(), BuildException);

    Assert.areEqual("Package paths produce the same name: src/modules/notes/runtime, src/noldova.desktop.notes.runtime.", error.message);
  }

  @TestMethod
  public async refusesAPackageThatDependsOnOneThatIsNotUnderSrc(): Promise<void> {
    await using tree = await PackageCatalogTests.createPackagesAsync({ "src/noldova.desktop.runtime": ["src/noldova.desktop.protocol"] });
    await rm(path.join(tree.path, "src", "noldova.desktop.protocol"), { recursive: true, force: true });

    const error = await Assert.throwsAsync(() => new PackageCatalog(tree.path).listPackagesAsync(), BuildException);

    Assert.areEqual("src/noldova.desktop.runtime depends on @noldova/desktop.protocol, which is not a package under src/.", error.message);
  }

  @TestMethod
  public async refusesPackagesWhoseDependenciesFormACycle(): Promise<void> {
    await using tree = await PackageCatalogTests.createPackagesAsync({
      "src/noldova.desktop.protocol": [],
      "src/noldova.desktop.runtime": ["src/noldova.desktop.cli", "src/noldova.desktop.protocol"],
      "src/noldova.desktop.cli": ["src/noldova.desktop.runtime"]
    });

    const error = await Assert.throwsAsync(() => new PackageCatalog(tree.path).listPackagesAsync(), BuildException);

    Assert.areEqual("The dependencies of @noldova/desktop.cli, @noldova/desktop.runtime form a cycle.", error.message);
  }

  @TestMethod
  public async listsAFixtureModulesPackageOnlyWhenAskedFor(): Promise<void> {
    await using tree = await PackageCatalogTests.createAsync();
    const catalog = new PackageCatalog(tree.path);

    Assert.areEqual(PackageCatalogTests.PROTOCOL, (await catalog.listPackagesAsync()).map(t => t.directory).join(", "));
    Assert.areEqual(`${PackageCatalogTests.PROTOCOL}, ${PackageCatalogTests.FIXTURE}`, (await catalog.listPackagesAsync(true)).map(t => t.directory).join(", "));
  }

  @TestMethod
  public async refusesAPackageThatDependsOnAFixtureModulesPackageWhenFixturesAreLeftOut(): Promise<void> {
    await using tree = await PackageCatalogTests.createAsync();
    await tree.writeAsync({
      "src/noldova.desktop.runtime/package.json": JSON.stringify({
        name: "@noldova/desktop.runtime",
        version: PackageCatalogTests.VERSION,
        dependencies: { [PackageCatalogTests.FIXTURE_NAME]: PackageCatalogTests.VERSION }
      })
    });

    const error = await Assert.throwsAsync(() => new PackageCatalog(tree.path).listPackagesAsync(), BuildException);

    Assert.areEqual(`src/noldova.desktop.runtime depends on ${PackageCatalogTests.FIXTURE_NAME}, which is not a package under src/.`, error.message);
  }

  private static async createPackagesAsync(packages: Readonly<Record<string, readonly string[]>>): Promise<SourceTreeFixture> {
    const files: Record<string, string> = {};
    for (const [directory, dependencies] of Object.entries(packages))
      files[`${directory}/package.json`] = JSON.stringify({
        name: PackageManifest.formatName(directory),
        version: PackageCatalogTests.VERSION,
        dependencies: Object.fromEntries(dependencies.map(t => [PackageManifest.formatName(t), PackageCatalogTests.VERSION]))
      });
    return await SourceTreeFixture.createAsync(files);
  }

  private static async createAsync(): Promise<SourceTreeFixture> {
    return await SourceTreeFixture.createAsync({
      [`${PackageCatalogTests.PROTOCOL}/package.json`]: JSON.stringify({ name: PackageCatalogTests.PROTOCOL_NAME, version: PackageCatalogTests.VERSION }),
      [`${PackageCatalogTests.FIXTURE}/package.json`]: JSON.stringify({
        name: PackageCatalogTests.FIXTURE_NAME,
        version: PackageCatalogTests.VERSION,
        dependencies: { [PackageCatalogTests.PROTOCOL_NAME]: PackageCatalogTests.VERSION }
      })
    });
  }
}
