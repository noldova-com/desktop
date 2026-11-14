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
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ReleaseSettings } from "../../../src/services/release/release-settings.js";

@TestClass
export class ReleaseSettingsTests {
  private static readonly INVALID: string = "The settings are invalid.";

  @TestMethod
  public async readsTheRootManifestsDesktopSectionAsync(): Promise<void> {
    await using folder = await ReleaseSettingsTests.createAppAsync(JSON.stringify({ desktop: { product: "Sample" } }));

    const settings = await ReleaseSettings.readAsync(folder.path, ReleaseSettingsTests.INVALID);

    Assert.areEqual("Sample", settings.readString("product"));
  }

  @TestMethod
  public async refusesAManifestWithoutADesktopSectionWithItsCauseAsync(): Promise<void> {
    await using folder = await ReleaseSettingsTests.createAppAsync(JSON.stringify({ name: "sample" }));

    const error = await Assert.throwsAsync(() => ReleaseSettings.readAsync(folder.path, ReleaseSettingsTests.INVALID), BuildException);

    Assert.areEqual(ReleaseSettingsTests.INVALID, error.message);
    Assert.isInstanceOf(error.cause, JsonException);
  }

  @TestMethod
  public async refusesAFolderWithoutAManifestAsync(): Promise<void> {
    await using folder = await ReleaseSettingsTests.createAppAsync(null);

    const error = await Assert.throwsAsync(() => ReleaseSettings.readAsync(folder.path, ReleaseSettingsTests.INVALID), BuildException);

    Assert.areEqual(ReleaseSettingsTests.INVALID, error.message);
    Assert.isInstanceOf(error.cause, Error);
  }

  private static async createAppAsync(manifest: string | null): Promise<{ readonly path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-release-settings-"));
    if (!Object.isNull(manifest))
      await writeFile(path.join(folder, "package.json"), manifest);
    return {
      path: folder,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    };
  }
}
