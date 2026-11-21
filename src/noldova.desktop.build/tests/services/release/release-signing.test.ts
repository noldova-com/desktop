/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProductIdentity } from "../../../src/models/packages/product-identity.js";
import { ReleaseSigning } from "../../../src/services/release/release-signing.js";
import { DevelopmentFolderFixture } from "../../fixtures/development-folder.fixture.js";

@TestClass
export class ReleaseSigningTests {
  private static readonly INVALID: string = "The root package.json's desktop.signedPlatforms must list distinct platforms among windows, macos, linux.";
  private static readonly PRODUCT: ProductIdentity = ProductIdentity.fromManifest(JsonReader.fromValue({ desktop: { product: DevelopmentFolderFixture.PRODUCT } }));

  @TestMethod
  public async listsTheSignedPlatformsInTheirOwnOrderForTheReleaseRepositoryAsync(): Promise<void> {
    const signing = await ReleaseSigningTests.readAsync({ signedPlatforms: ["linux", "macos", "windows"] });

    Assert.areEqual("windows,macos,linux", signing.listSignedPlatforms(ReleaseSigningTests.PRODUCT, "Example/Sample-App").join());
  }

  @TestMethod
  public async signsNothingInAnotherRepositoryAsync(): Promise<void> {
    const signing = await ReleaseSigningTests.readAsync({});

    Assert.areEqual(0, signing.listSignedPlatforms(ReleaseSigningTests.PRODUCT, "someone/sample-fork").length);
  }

  @TestMethod
  public async refusesTheReleaseRepositoryWhenAPlatformIsUnsignedAsync(): Promise<void> {
    for (const [platforms, unsigned] of [[[], "windows and macos and linux"], [["windows", "macos"], "linux"]] as const) {
      const signing = await ReleaseSigningTests.readAsync({ signedPlatforms: platforms });

      const error = Assert.throws(() => signing.listSignedPlatforms(ReleaseSigningTests.PRODUCT, "example/sample-app"), BuildException);

      Assert.areEqual("example/sample-app is Sample App's update feed, which gets only signed Windows, macOS and Linux packages, "
        + `but desktop.signedPlatforms leaves out ${unsigned}.`, error.message);
    }
  }

  @TestMethod
  public async refusesSignedPlatformsThatAreNotADistinctListOfSignablePlatformsAsync(): Promise<void> {
    for (const platforms of ["windows", ["windows", "windows"], ["solaris"], [1]]) {
      const error = await Assert.throwsAsync(() => ReleaseSigningTests.readAsync({ signedPlatforms: platforms }), BuildException);

      Assert.areEqual(ReleaseSigningTests.INVALID, error.message, JSON.stringify(platforms));
    }
  }

  private static async readAsync(desktop: Readonly<Record<string, unknown>>): Promise<ReleaseSigning> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-release-signing-"));
    try {
      await writeFile(path.join(folder, "package.json"), JSON.stringify({ desktop }));
      return await ReleaseSigning.readAsync(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}
