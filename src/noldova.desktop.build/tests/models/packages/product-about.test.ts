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
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductAbout } from "../../../src/models/packages/product-about.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { AngularProject } from "../../../src/services/angular/angular-project.js";
import { ProductFile } from "../../../src/services/angular/product-file.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { NpmCommand } from "../../../src/services/toolchain/npm-command.js";
import { FolderFixture } from "../../fixtures/folder.fixture.js";

@TestClass
export class ProductAboutTests {
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
  private static readonly ABOUT: Readonly<Record<string, unknown>> = {
    description: "Sample work, done together.",
    website: "https://sample.example",
    releases: "https://github.com/example/sample-app/releases/latest",
    licenses: "Sample App is open source under the MIT license.\nIts fonts are under the SIL Open Font License."
  };

  @TestMethod
  public readsEachValueTheAppSupplies(): void {
    const about = ProductAboutTests.read(ProductAboutTests.ABOUT).about;

    Assert.areEqual(JSON.stringify(ProductAboutTests.ABOUT), JSON.stringify(about.toJson()));
  }

  @TestMethod
  public leavesOutEachValueTheAppDoesNotSupply(): void {
    const none = ProductAboutTests.read(null).about;
    const some = ProductAboutTests.read({ website: "https://sample.example" }).about;

    Assert.areEqual(JSON.stringify({ description: null, website: null, releases: null, licenses: null }), JSON.stringify(none.toJson()));
    Assert.areEqual(JSON.stringify({ description: null, website: "https://sample.example", releases: null, licenses: null }), JSON.stringify(some.toJson()));
    Assert.areEqual(ProductAbout.NONE, new ProductIdentity("Sample App", "Sample", "sample-app", "com.example.sample", "com.example.sample.development", ".sample/app",
      ["Sample/App", "Sample/App", "sample/app"], "SAMPLE_APP_DATA_DIR", "assets/icons", "example/sample-app").about);
  }

  @TestMethod
  public refusesEachValueThatAboutCannotShow(): void {
    const refusals: readonly (readonly [unknown, string])[] = [
      ["Sample", "about must be an object"],
      [{ description: String.empty }, "about.description must be one line of text"],
      [{ description: "   " }, "about.description must be one line of text"],
      [{ description: "Two\nlines" }, "about.description must be one line of text"],
      [{ description: 7 }, "about.description must be one line of text"],
      [{ website: "http://sample.example" }, "about.website must be an https address"],
      [{ website: "sample.example" }, "about.website must be an https address"],
      [{ website: "https://sample.example/a page" }, "about.website must be an https address"],
      [{ releases: "file:///releases" }, "about.releases must be an https address"],
      [{ licenses: " " }, "about.licenses must be text"],
      [{ licenses: ["MIT"] }, "about.licenses must be text"]
    ];

    for (const [about, message] of refusals) {
      const refusal = Assert.throws(() => ProductAboutTests.read(about), BuildException);
      Assert.areEqual(`The root package.json's desktop.product.${message}.`, refusal.message, JSON.stringify(about));
    }
  }

  @TestMethod
  public async writesWhatTheAppSuppliesBesideItsNameForTheWindow(): Promise<void> {
    const supplied = await ProductAboutTests.writeAsync(ProductAboutTests.ABOUT);
    const none = await ProductAboutTests.writeAsync(null);

    Assert.areEqual(ProductAboutTests.formatFile({ ...ProductAboutTests.ABOUT, logo: null }), supplied);
    Assert.areEqual(ProductAboutTests.formatFile({ description: null, website: null, releases: null, licenses: null, logo: null }), none);
  }

  @TestMethod
  public async namesTheAppsLightAndDarkIconsAsAboutsLogo(): Promise<void> {
    const both = await ProductAboutTests.writeAsync(null, ["icon-dark-512.png", "icon-light-512.png"]);
    const dark = await ProductAboutTests.writeAsync(null, ["icon-dark-512.png"]);
    const light = await ProductAboutTests.writeAsync(null, ["icon-light-512.png"]);
    const none = { description: null, website: null, releases: null, licenses: null };

    Assert.areEqual(ProductAboutTests.formatFile({ ...none, logo: { light: "about/icon-light-512.png", dark: "about/icon-dark-512.png" } }), both);
    Assert.areEqual(ProductAboutTests.formatFile({ ...none, logo: { light: "about/icon-dark-512.png", dark: "about/icon-dark-512.png" } }), dark);
    Assert.areEqual(ProductAboutTests.formatFile({ ...none, logo: null }), light);
  }

  @TestMethod
  public async putsTheLogoBesideTheBuiltWindowsFilesWhereverTheWindowIsBuilt(): Promise<void> {
    const root = await ProductAboutTests.createAppAsync(null, ["icon-dark-512.png", "icon-light-512.png"]);
    try {
      await ProductAboutTests.writeTextAsync(path.join(root, "src", "sample.window.app", "angular.json"), "{}");
      await ProductAboutTests.writeTextAsync(path.join(root, "node_modules", "@angular", "cli", "bin", "ng.js"), String.empty);
      const runner = new ProcessRunner();
      const project = new AngularProject(root, runner, new NpmCommand(runner, {}));
      const packaged = path.join(root, "stage", "window");

      await project.buildAsync(new PassThrough(), null);
      await project.buildAsync(new PassThrough(), packaged);

      for (const folder of [path.join(root, "_build", "window"), packaged])
        for (const file of ["icon-dark-512.png", "icon-light-512.png"])
          Assert.areEqual(file, await readFile(path.join(folder, "browser", "about", file), "utf8"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async putsNoLogoBesideTheWindowForAnAppWithoutItsIcon(): Promise<void> {
    const root = await ProductAboutTests.createAppAsync(null, []);
    try {
      await ProductAboutTests.writeTextAsync(path.join(root, "src", "sample.window.app", "angular.json"), "{}");
      await ProductAboutTests.writeTextAsync(path.join(root, "node_modules", "@angular", "cli", "bin", "ng.js"), String.empty);
      const runner = new ProcessRunner();

      await new AngularProject(root, runner, new NpmCommand(runner, {})).buildAsync(new PassThrough(), null);

      Assert.isFalse(existsSync(path.join(root, "_build", "window", "browser", "about")));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  private static read(about: unknown): ProductIdentity {
    return ProductIdentity.fromManifest(JsonReader.fromValue({ desktop: { product: Object.isNull(about) ? ProductAboutTests.PRODUCT : { ...ProductAboutTests.PRODUCT, about } } }));
  }

  private static async createAppAsync(about: Readonly<Record<string, unknown>> | null, icons: readonly string[]): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "desktop-product-"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ desktop: { product: Object.isNull(about) ? ProductAboutTests.PRODUCT : { ...ProductAboutTests.PRODUCT, about } } }));
    for (const icon of icons)
      await ProductAboutTests.writeTextAsync(path.join(root, "assets", "icons", icon), icon);
    await mkdir(path.join(root, "src"), { recursive: true });
    return root;
  }

  private static async writeTextAsync(file: string, text: string): Promise<void> {
    await FolderFixture.ensureAsync(path.dirname(file));
    await writeFile(file, text);
  }

  private static async writeAsync(about: Readonly<Record<string, unknown>> | null, icons: readonly string[] = []): Promise<string> {
    const root = await ProductAboutTests.createAppAsync(about, icons);
    try {
      const file = new ProductFile(root);
      await file.writeAsync();
      return await readFile(file.file, "utf8");
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  private static formatFile(about: Readonly<Record<string, unknown>>): string {
    return [
      "/**",
      " * @license",
      " * Copyright (c) Noldova.",
      " *",
      " * This source code is licensed under the license found in the",
      " * LICENSE file in the root directory of this source tree.",
      " */",
      String.empty,
      "import type { IProductAbout, IProductTitleBar } from \"@noldova/desktop.window/build\";",
      String.empty,
      "export const productName: string = \"Sample App\";",
      `export const productAbout: IProductAbout = ${JSON.stringify(about)};`,
      "export const productTitleBar: IProductTitleBar = {\"name\":null,\"icon\":null};",
      String.empty
    ].join("\n");
  }
}
