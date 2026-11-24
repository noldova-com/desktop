/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { TitleBarIcon } from "../../../src/services/angular/title-bar-icon.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class TitleBarIconTests {
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
  public async hasNoIconWhenTheAppGivesNone(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "assets/title-bar.svg": "<svg/>" });

    Assert.isNull(TitleBarIcon.of(tree.path, TitleBarIconTests.identity(null)));
  }

  @TestMethod
  public async copiesAFileIconBesideTheWindowAndNamesItsAddress(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "assets/marks/Title Bar.png": "png" });
    const window = path.join(tree.path, "dist");

    const icon = TitleBarIcon.of(tree.path, TitleBarIconTests.identity("assets/marks/Title Bar.png"));
    await icon?.copyAsync(window);

    Assert.areEqual("title-bar/Title%20Bar.png|png", [icon?.address, await readFile(path.join(window, "browser", "title-bar", "Title Bar.png"), "utf8")].join("|"));
  }

  @TestMethod
  public async showsADataUrlAsItIsAndCopiesNothing(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();
    const window = path.join(tree.path, "dist");
    const data = "data:image/svg+xml,%3Csvg%2F%3E";

    const icon = TitleBarIcon.of(tree.path, TitleBarIconTests.identity(data));
    await icon?.copyAsync(window);

    Assert.areEqual(JSON.stringify([data, false]), JSON.stringify([icon?.address, existsSync(path.join(window, "browser", "title-bar"))]));
  }

  @TestMethod
  public async stopsTheBuildForAnIconFileTheAppDoesNotHave(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();

    const refusal = Assert.throws(() => TitleBarIcon.of(tree.path, TitleBarIconTests.identity("assets/title-bar.svg")), BuildException);

    Assert.areEqual("The root package.json's desktop.product.titleBarIcon names assets/title-bar.svg, which isn't in the app's tree.", refusal.message);
  }

  private static identity(titleBarIcon: string | null): ProductIdentity {
    const product = Object.isNull(titleBarIcon) ? TitleBarIconTests.PRODUCT : { ...TitleBarIconTests.PRODUCT, titleBarIcon };
    return ProductIdentity.fromManifest(JsonReader.fromValue({ desktop: { product } }));
  }
}
