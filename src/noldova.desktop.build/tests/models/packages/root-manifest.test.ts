/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { RootManifest } from "../../../src/models/packages/root-manifest.js";
import { Resources } from "../../../src/resources.js";

@TestClass
export class RootManifestTests {
  private static readonly DEFAULT_PREFIX: string = "@noldova/desktop.";

  @TestMethod
  public async takesTheDefaultPrefixWhenTheRootHasNoManifestAsync(): Promise<void> {
    await using folder = await RootManifestTests.createFolderAsync();

    Assert.areEqual(RootManifestTests.DEFAULT_PREFIX, await RootManifest.readModulePackagePrefixAsync(folder.path));
  }

  @TestMethod
  @TestData("not JSON")
  @TestData("1")
  @TestData("null")
  @TestData("{}")
  @TestData("{\"desktop\":1}")
  @TestData("{\"desktop\":null}")
  @TestData("{\"desktop\":{}}")
  public async takesTheDefaultPrefixWhenTheManifestNamesNoneAsync(text: string): Promise<void> {
    await using folder = await RootManifestTests.createFolderAsync(text);

    Assert.areEqual(RootManifestTests.DEFAULT_PREFIX, await RootManifest.readModulePackagePrefixAsync(folder.path));
  }

  @TestMethod
  @TestData("@example/")
  @TestData("@example/app.")
  @TestData("@noldova-com/desktop-")
  public async readsTheAppsPrefixAsync(prefix: string): Promise<void> {
    await using folder = await RootManifestTests.createFolderAsync(JSON.stringify({ desktop: { modulePackagePrefix: prefix } }));

    Assert.areEqual(prefix, await RootManifest.readModulePackagePrefixAsync(folder.path));
  }

  @TestMethod
  @TestData("1")
  @TestData("\"example\"")
  @TestData("\"@example\"")
  @TestData("\"@example/app\"")
  public async refusesAPrefixOfAnyOtherFormAsync(value: string): Promise<void> {
    await using folder = await RootManifestTests.createFolderAsync(`{"desktop":{"modulePackagePrefix":${value}}}`);

    await Assert.throwsAsync(() => RootManifest.readModulePackagePrefixAsync(folder.path), BuildException);
  }

  @TestMethod
  public async passesOnAFailureToReadTheManifestOtherThanAMissingFileAsync(): Promise<void> {
    await using folder = await RootManifestTests.createFolderAsync();
    await mkdir(path.join(folder.path, "package.json"));

    const error = await Assert.throwsAsync(() => RootManifest.readModulePackagePrefixAsync(folder.path), Error);

    Assert.isFalse(error instanceof BuildException);
  }

  @TestMethod
  public async readsTheVersionTheProtocolVersionAndTheOverridesAsync(): Promise<void> {
    await using folder = await RootManifestTests.createFolderAsync(JSON.stringify({ version: "1.2.3-rc.1", desktop: { protocolVersion: 4 }, overrides: { "shared-type": "2.1.0" } }));

    const manifest = await RootManifest.readAsync(folder.path);

    Assert.areEqual("1.2.3-rc.1", manifest.productVersion);
    Assert.areEqual(4, manifest.protocolVersion);
    Assert.areEqual(JSON.stringify({ "shared-type": "2.1.0" }), JSON.stringify(manifest.overrides));
  }

  @TestMethod
  public async refusesARootWithoutAManifestAsync(): Promise<void> {
    await using folder = await RootManifestTests.createFolderAsync();

    const error = await Assert.throwsAsync(() => RootManifest.readAsync(folder.path), BuildException);

    Assert.areEqual(Resources.rootVersionInvalid, error.message);
    Assert.isInstanceOf(error.cause, Error);
  }

  @TestMethod
  public readsTheAppsOverridesAsTheyAre(): void {
    const manifest = { version: "1.2.3" };

    const read = [{ "shared-type": "2.1.0" }, [], null].map(t => RootManifest.parse(JSON.stringify({ ...manifest, overrides: t })).overrides);

    Assert.areEqual(JSON.stringify([{ "shared-type": "2.1.0" }, [], null]), JSON.stringify(read));
    Assert.isUndefined(RootManifest.parse(JSON.stringify(manifest)).overrides);
  }

  @TestMethod
  public readsNoProtocolVersionWithoutADesktopObjectOrTheField(): void {
    for (const desktop of [undefined, [], 1, {}])
      Assert.isNull(RootManifest.parse(JSON.stringify({ version: "1.0.0", desktop })).protocolVersion);
  }

  @TestMethod
  public refusesAManifestThatIsNotJsonOrHasNoVersionOfTheForm(): void {
    for (const text of ["{", JSON.stringify({}), JSON.stringify({ version: 1 }), JSON.stringify({ version: "1.0" }), JSON.stringify({ version: "1.0.0-01" })])
      Assert.areEqual(Resources.rootVersionInvalid, Assert.throws(() => RootManifest.parse(text), BuildException).message);
  }

  @TestMethod
  public refusesAProtocolVersionThatIsNotAPositiveWholeNumber(): void {
    for (const protocolVersion of ["4", 0, 1.5, -1])
      Assert.areEqual(Resources.rootProtocolVersionInvalid,
        Assert.throws(() => RootManifest.parse(JSON.stringify({ version: "1.0.0", desktop: { protocolVersion } })), BuildException).message);
  }

  private static async createFolderAsync(manifest?: string): Promise<{ readonly path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-root-manifest-"));
    if (!Object.isUndefined(manifest))
      await writeFile(path.join(folder, "package.json"), manifest);
    return {
      path: folder,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    };
  }
}
