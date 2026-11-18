/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildVariant } from "../../../src/models/modules/build-variant.js";
import { BuildProduct } from "../../../src/services/packages/build-product.js";

@TestClass
export class BuildProductTests {
  private static readonly FEED: string = "https://updates.example.test/";
  private static readonly RELEASE_FEED: string = "https://github.com/example/sample-app/releases/latest/download/";
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
  public async writesTheDevelopmentProductIntoTheBuildFolderWithoutAFeedAsync(): Promise<void> {
    const root = await BuildProductTests.createRootAsync({});
    try {
      await new BuildProduct(root).writeAsync("print", null, new BuildVariant(false, [], true, BuildProductTests.FEED));

      const product = await BuildProductTests.readAsync(path.join(root, "_build", "product.json"));
      Assert.areEqual(["Sample App", "sample-app", "Sample/App", "assets/icons", "1.2.3", "print"].join(), [product.readString("name"), product.readString("slug"), product.readObject("deviceFolders").readString("windows"), product.readString("icons"), product.readString("version"), product.readString("build")].join());
      Assert.isNull(product.readValue("updateFeed"));
      Assert.isNull(product.readValue("windowsPublisher"));
      Assert.isFalse(product.hasField("permissionsModule"));
      Assert.isFalse(product.hasField("installFolder"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async takesAPackagedVariantsFeedOrElseTheProductsAsync(): Promise<void> {
    const root = await BuildProductTests.createRootAsync({ permissionsModule: "permissions", installFolder: "Sample" });
    try {
      const output = path.join(root, "out");
      const product = new BuildProduct(root);

      await product.writeAsync("print", output, new BuildVariant(false, [], true, BuildProductTests.FEED));
      const variantFeed = (await BuildProductTests.readAsync(path.join(output, "product.json"))).readValue("updateFeed");
      await product.writeAsync("print", output, new BuildVariant(false, [], true));
      const productFeed = await BuildProductTests.readAsync(path.join(output, "product.json"));

      Assert.areEqual(BuildProductTests.FEED, variantFeed);
      Assert.areEqual(BuildProductTests.RELEASE_FEED, productFeed.readValue("updateFeed"));
      Assert.areEqual("permissions", productFeed.readString("permissionsModule"));
      Assert.areEqual("Sample", productFeed.readString("installFolder"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async takesOnlyTheVariantsFeedForAnUnpackagedOutputAsync(): Promise<void> {
    const root = await BuildProductTests.createRootAsync({});
    try {
      const output = path.join(root, "out");
      const product = new BuildProduct(root);

      await product.writeAsync("print", output, new BuildVariant(false, []));
      const none = (await BuildProductTests.readAsync(path.join(output, "product.json"))).readValue("updateFeed");
      await product.writeAsync("print", output, new BuildVariant(true, [], false, BuildProductTests.FEED));
      const named = (await BuildProductTests.readAsync(path.join(output, "product.json"))).readValue("updateFeed");

      Assert.isNull(none);
      Assert.areEqual(BuildProductTests.FEED, named);
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async setsTheWindowsPublisherAndKeepsTheRestAsync(): Promise<void> {
    const root = await BuildProductTests.createRootAsync({});
    try {
      const output = path.join(root, "out");
      await new BuildProduct(root).writeAsync("print", output, BuildVariant.REGULAR);

      await BuildProduct.setWindowsPublisherAsync(output, "CN=Sample");

      const product = await BuildProductTests.readAsync(path.join(output, "product.json"));
      Assert.areEqual("CN=Sample", product.readString("windowsPublisher"));
      Assert.areEqual("Sample App", product.readString("name"));
    }
    finally {
      await rm(root, { recursive: true, force: true });
    }
  }

  private static async createRootAsync(fields: Readonly<Record<string, unknown>>): Promise<string> {
    const root = await mkdtemp(path.join(tmpdir(), "build-product-"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ version: "1.2.3", desktop: { product: { ...BuildProductTests.PRODUCT, ...fields } } }));
    return root;
  }

  private static async readAsync(file: string): Promise<JsonReader> {
    return JsonReader.parse(await readFile(file, "utf8"));
  }
}
