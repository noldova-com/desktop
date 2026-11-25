/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { Resources } from "../../../src/resources.js";
import { ProductFile } from "../../../src/services/angular/product-file.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class ProductFileTests {
  private static readonly PRODUCT: Readonly<Record<string, unknown>> = {
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

  @TestMethod
  public async writesTheNameAndAboutWithoutALogoForAnAppWithoutIcons(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();
    await writeFile(path.join(tree.path, "package.json"), JSON.stringify({ desktop: { product: ProductFileTests.PRODUCT } }));
    const file = new ProductFile(tree.path);

    await file.writeAsync();
    const text = await readFile(file.file, "utf8");

    Assert.areEqual(path.join(tree.path, ...Resources.productFileSegments), file.file);
    Assert.isTrue(text.startsWith(Resources.licenseHeaderBlock), text);
    Assert.isTrue(text.includes("export const productName: string = \"Sample App\";"), text);
    Assert.isTrue(text.includes("\"logo\":null"), text);
  }

  @TestMethod
  public async writesTheLogoOfAnAppWithIcons(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "assets/icons/icon-dark-512.png": "dark" });
    await writeFile(path.join(tree.path, "package.json"), JSON.stringify({ desktop: { product: ProductFileTests.PRODUCT } }));
    const file = new ProductFile(tree.path);

    await file.writeAsync();

    Assert.isTrue((await readFile(file.file, "utf8")).includes("\"logo\":{\"light\":\"about/icon-dark-512.png\",\"dark\":\"about/icon-dark-512.png\"}"));
  }

  @TestMethod
  public async writesAnEmptyTitleBarForAnAppThatGivesItNothing(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();
    await writeFile(path.join(tree.path, "package.json"), JSON.stringify({ desktop: { product: ProductFileTests.PRODUCT } }));
    const file = new ProductFile(tree.path);

    await file.writeAsync();
    const text = await readFile(file.file, "utf8");

    Assert.isTrue(text.includes("import type { IProductAbout, IProductTitleBar } from \"@noldova/desktop.window/build\";"), text);
    Assert.isTrue(text.includes("export const productTitleBar: IProductTitleBar = {\"name\":null,\"icon\":null,\"documentTabs\":false};"), text);
  }

  @TestMethod
  public async writesThatTheDocumentTabsStandInTheTitleBarWhenTheAppAsks(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();
    await writeFile(path.join(tree.path, "package.json"), JSON.stringify({ desktop: { product: { ...ProductFileTests.PRODUCT, titleBarDocumentTabs: true } } }));
    const file = new ProductFile(tree.path);

    await file.writeAsync();

    Assert.isTrue((await readFile(file.file, "utf8")).includes("export const productTitleBar: IProductTitleBar = {\"name\":null,\"icon\":null,\"documentTabs\":true};"));
  }

  @TestMethod
  public async writesTheTitleBarsNameAndTheAddressItsIconFileIsCopiedTo(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "assets/Title Bar.svg": "<svg/>" });
    await writeFile(path.join(tree.path, "package.json"), JSON.stringify({ desktop: { product: { ...ProductFileTests.PRODUCT, titleBarName: "Sample \"Notes\"",
      titleBarIcon: "assets/Title Bar.svg" } } }));
    const file = new ProductFile(tree.path);

    await file.writeAsync();

    Assert.isTrue((await readFile(file.file, "utf8")).includes("export const productTitleBar: IProductTitleBar = {\"name\":\"Sample \\\"Notes\\\"\",\"icon\":\"title-bar/Title%20Bar.svg\",\"documentTabs\":false};"));
  }
}
