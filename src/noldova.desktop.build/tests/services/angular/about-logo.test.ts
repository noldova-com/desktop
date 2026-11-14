/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { AboutLogo } from "../../../src/services/angular/about-logo.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class AboutLogoTests {
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
  private static readonly IDENTITY: ProductIdentity = ProductIdentity.fromManifest(JsonReader.fromValue({ desktop: { product: AboutLogoTests.PRODUCT } }));

  @TestMethod
  public async hasNoLogoWithoutTheAppsDarkIcon(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "assets/icons/icon-light-512.png": "light" });

    Assert.isNull(AboutLogo.of(tree.path, AboutLogoTests.IDENTITY));
  }

  @TestMethod
  public async showsTheLightIconInTheLightThemeAndCopiesBothBesideTheWindow(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "assets/icons/icon-dark-512.png": "dark", "assets/icons/icon-light-512.png": "light" });
    const window = path.join(tree.path, "dist");

    const logo = AboutLogo.of(tree.path, AboutLogoTests.IDENTITY);
    await logo?.copyAsync(window);

    Assert.areEqual(JSON.stringify({ light: "about/icon-light-512.png", dark: "about/icon-dark-512.png" }), JSON.stringify(logo?.toJson()));
    Assert.areEqual("light|dark", [
      await readFile(path.join(window, "browser", "about", "icon-light-512.png"), "utf8"),
      await readFile(path.join(window, "browser", "about", "icon-dark-512.png"), "utf8")
    ].join("|"));
  }

  @TestMethod
  public async showsTheDarkIconInBothThemesWithoutALightOne(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "assets/icons/icon-dark-512.png": "dark" });
    const window = path.join(tree.path, "dist");
    await mkdir(path.join(window, "browser", "about"), { recursive: true });
    await writeFile(path.join(window, "browser", "about", "stale.txt"), "stale");

    const logo = AboutLogo.of(tree.path, AboutLogoTests.IDENTITY);
    await logo?.copyAsync(window);

    Assert.areEqual(JSON.stringify({ light: "about/icon-dark-512.png", dark: "about/icon-dark-512.png" }), JSON.stringify(logo?.toJson()));
    Assert.areEqual("dark", await readFile(path.join(window, "browser", "about", "icon-dark-512.png"), "utf8"));
  }
}
