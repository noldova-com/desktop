/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { PassThrough, type Writable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PackageManifest } from "../../src/models/packages/package-manifest.js";
import { Resources } from "../../src/resources.js";
import type { PackageCatalog } from "../../src/services/packages/package-catalog.js";
import { SourceTreeFixture } from "../fixtures/source-tree.fixture.js";

interface ILayoutCheck {
  readonly title: string;
  runAsync(output: Writable): Promise<boolean>;
}

interface ILayoutCheckModule {
  readonly PackageLayoutCheck: new (root: string, catalog: PackageCatalog) => ILayoutCheck;
}

interface ICatalogModule {
  readonly PackageCatalog: new (root: string) => PackageCatalog;
}

@TestClass
export class PackageLayoutCheckTests {
  private static readonly CHECK: readonly string[] = ["scripts", "checks", "package-layout-check.ts"];
  private static readonly CATALOG: readonly string[] = ["src", "noldova.desktop.build", "src", "services", "packages", "package-catalog.ts"];
  private static readonly COMPLETE: readonly string[] = ["src/tsconfig.json", "src/resources.ts", "tests/tsconfig.json"];
  private static readonly VERSION: string = "__VERSION__";

  @TestMethod
  public async passesPackagesWithSourceTestsConfigurationsAndResourcesAndLeavesFixturePackagesOut(): Promise<void> {
    await using tree = await PackageLayoutCheckTests.createAsync({
      "src/noldova.desktop.runtime": PackageLayoutCheckTests.COMPLETE,
      "src/noldova.desktop.protocol": PackageLayoutCheckTests.COMPLETE,
      [`${Resources.moduleFixtureFolder}/notes/runtime`]: ["src/tsconfig.json"]
    });
    const output = new PassThrough();

    const check = await PackageLayoutCheckTests.createCheckAsync(tree);

    Assert.isTrue(await check.runAsync(output));
    Assert.areEqual("Checked the layout of 2 packages.\n", PackageLayoutCheckTests.read(output));
    Assert.areEqual("Package layout", check.title);
  }

  @TestMethod
  public async failsWithEachPackageThatLacksAConfigurationResourcesOrTests(): Promise<void> {
    await using tree = await PackageLayoutCheckTests.createAsync({
      "src/noldova.desktop.runtime": ["src/resources.ts"],
      "src/noldova.desktop.protocol": ["src/tsconfig.json", "tests/tsconfig.json"],
      "src/modules/notes/runtime": PackageLayoutCheckTests.COMPLETE
    });
    const output = new PassThrough();

    Assert.isFalse(await (await PackageLayoutCheckTests.createCheckAsync(tree)).runAsync(output));

    const lines = PackageLayoutCheckTests.read(output).split("\n");
    Assert.areEqual(
      "src/noldova.desktop.protocol: has no src/resources.ts,src/noldova.desktop.runtime: has no src/tsconfig.json,src/noldova.desktop.runtime: has no tests/tsconfig.json",
      lines.slice(0, 3).map(t => t.split(";")[0]).join(","));
    Assert.areEqual("Checked the layout of 3 packages.", lines[3]);
  }

  @TestMethod
  public async failsWithTheReasonWhenTheCatalogCannotReadAPackageAndPassesOnAnyOtherError(): Promise<void> {
    await using tree = await PackageLayoutCheckTests.createAsync({ "src/noldova.desktop.runtime": PackageLayoutCheckTests.COMPLETE });
    await tree.writeAsync({ "src/noldova.desktop.runtime/package.json": JSON.stringify({ name: "@noldova/desktop.other", version: PackageLayoutCheckTests.VERSION }) });
    const output = new PassThrough();
    const failing = await PackageLayoutCheckTests.createCatalogAsync(tree);
    failing.listPackagesAsync = () => Promise.reject(new Error("unexpected"));

    Assert.isFalse(await (await PackageLayoutCheckTests.createCheckAsync(tree)).runAsync(output));
    const error = await Assert.throwsAsync(async () => await (await PackageLayoutCheckTests.createCheckAsync(tree, failing)).runAsync(new PassThrough()), Error);

    Assert.areEqual("src/noldova.desktop.runtime/package.json must be named \"@noldova/desktop.runtime\", the name its folder gives.\n", PackageLayoutCheckTests.read(output));
    Assert.areEqual("unexpected", error.message);
  }

  @TestMethod
  public findsNoFileThatNoFolderAboveTheTestHoldsAndNamesIt(): void {
    const error = Assert.throws(() => PackageLayoutCheckTests.locate(["no-such-folder", "no-such-file.ts"]), Error);

    Assert.areEqual(`${path.join("no-such-folder", "no-such-file.ts")} is not under any folder above this test.`, error.message);
  }

  private static async createCheckAsync(tree: SourceTreeFixture, catalog?: PackageCatalog): Promise<ILayoutCheck> {
    const module: unknown = await import(pathToFileURL(PackageLayoutCheckTests.locate(PackageLayoutCheckTests.CHECK)).href);
    if (!PackageLayoutCheckTests.isLayoutCheckModule(module))
      throw new Error(PackageLayoutCheckTests.CHECK.join("/"));
    return new module.PackageLayoutCheck(tree.path, catalog ?? await PackageLayoutCheckTests.createCatalogAsync(tree));
  }

  private static async createCatalogAsync(tree: SourceTreeFixture): Promise<PackageCatalog> {
    const module: unknown = await import(pathToFileURL(PackageLayoutCheckTests.locate(PackageLayoutCheckTests.CATALOG)).href);
    if (!PackageLayoutCheckTests.isCatalogModule(module))
      throw new Error(PackageLayoutCheckTests.CATALOG.join("/"));
    return new module.PackageCatalog(tree.path);
  }

  private static isLayoutCheckModule(value: unknown): value is ILayoutCheckModule {
    return Object.isObject(value) && "PackageLayoutCheck" in value && Object.isFunction(value.PackageLayoutCheck);
  }

  private static isCatalogModule(value: unknown): value is ICatalogModule {
    return Object.isObject(value) && "PackageCatalog" in value && Object.isFunction(value.PackageCatalog);
  }

  private static locate(segments: readonly string[]): string {
    let folder = path.dirname(fileURLToPath(import.meta.url));
    while (!existsSync(path.join(folder, ...segments))) {
      const parent = path.dirname(folder);
      if (parent === folder)
        throw new Error(`${path.join(...segments)} is not under any folder above this test.`);
      folder = parent;
    }
    return path.join(folder, ...segments);
  }

  private static async createAsync(packages: Readonly<Record<string, readonly string[]>>): Promise<SourceTreeFixture> {
    const files: Record<string, string> = {};
    for (const [directory, present] of Object.entries(packages)) {
      files[`${directory}/package.json`] = JSON.stringify({ name: PackageManifest.formatName(directory), version: PackageLayoutCheckTests.VERSION });
      for (const file of present)
        files[`${directory}/${file}`] = "{}\n";
    }
    return await SourceTreeFixture.createAsync(files);
  }

  private static read(output: PassThrough): string {
    return output.read()?.toString() ?? String.empty;
  }
}
