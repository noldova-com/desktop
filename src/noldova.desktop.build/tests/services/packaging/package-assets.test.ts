/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackageAssets } from "../../../src/services/packaging/package-assets.js";
import { FolderFixture } from "../../fixtures/folder.fixture.js";

@TestClass
export class PackageAssetsTests {
  private static readonly ENTITLEMENTS: readonly string[] = ["assets", "macos", "entitlements.plist"];

  @TestMethod
  public async locatesTheAppsOwnAssetBeforeTheDefault(): Promise<void> {
    await using app = await PackageAssetsTests.createAppAsync(true);

    const located = new PackageAssets(app.path).locate(PackageAssetsTests.ENTITLEMENTS);

    Assert.areEqual(path.join(app.path, ...PackageAssetsTests.ENTITLEMENTS), located);
  }

  @TestMethod
  public async locatesNoldovaDesktopsDefaultWhenTheAppHasNone(): Promise<void> {
    await using app = await PackageAssetsTests.createAppAsync(false);

    const located = new PackageAssets(app.path).locate(PackageAssetsTests.ENTITLEMENTS);

    Assert.isFalse(located.startsWith(app.path), located);
    Assert.isTrue(located.endsWith(path.join(...PackageAssetsTests.ENTITLEMENTS)), located);
    Assert.isTrue(existsSync(located), located);
  }

  @TestMethod
  public async listsTheAppsPlaceBeforeTheDefaultOne(): Promise<void> {
    await using app = await PackageAssetsTests.createAppAsync(false);

    const [own, fallback] = new PackageAssets(app.path).list(PackageAssetsTests.ENTITLEMENTS);

    Assert.areEqual(path.join(app.path, ...PackageAssetsTests.ENTITLEMENTS), own);
    Assert.areEqual(new PackageAssets(app.path).locate(PackageAssetsTests.ENTITLEMENTS), fallback);
  }

  @TestMethod
  public async requiresTheAppsOwnAsset(): Promise<void> {
    await using app = await PackageAssetsTests.createAppAsync(true);

    const required = new PackageAssets(app.path).require(PackageAssetsTests.ENTITLEMENTS, "the macOS entitlements");

    Assert.areEqual(path.join(app.path, ...PackageAssetsTests.ENTITLEMENTS), required);
  }

  @TestMethod
  public async refusesARequiredAssetTheAppLacksEvenWithADefault(): Promise<void> {
    await using app = await PackageAssetsTests.createAppAsync(false);

    const error = Assert.throws(() => new PackageAssets(app.path).require(PackageAssetsTests.ENTITLEMENTS, "the macOS entitlements"), BuildException);

    Assert.areEqual("The app has no assets/macos/entitlements.plist, the macOS entitlements; Noldova Desktop brings no default for it, so the package cannot be built.",
      error.message);
  }

  private static async createAppAsync(hasEntitlements: boolean): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "package-assets-"));
    if (hasEntitlements) {
      const file = path.join(folder, ...PackageAssetsTests.ENTITLEMENTS);
      await FolderFixture.ensureAsync(path.dirname(file));
      await writeFile(file, "<plist/>");
    }
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }
}
