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

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { SupportedTargets } from "../../../src/services/release/supported-targets.js";

@TestClass
export class SupportedTargetsTests {
  @TestMethod
  public async readsTheListedTargetsInTheOrderOfAllTargetsAsync(): Promise<void> {
    await using folder = await SupportedTargetsTests.createAppAsync(JSON.stringify({ desktop: { supportedTargets: ["linux-x64", "macos-arm64", "windows-x64"] } }));

    const targets = await SupportedTargets.readAsync(folder.path);

    Assert.areEqual("windows-x64,macos-arm64,linux-x64", targets?.map(t => t.id).join(","));
  }

  @TestMethod
  public async readsAnEmptyListAsNoTargetsAsync(): Promise<void> {
    await using folder = await SupportedTargetsTests.createAppAsync(JSON.stringify({ desktop: { supportedTargets: [] } }));

    const targets = await SupportedTargets.readAsync(folder.path);

    Assert.areEqual(0, targets?.length);
  }

  @TestMethod
  public async readsAMissingListAsNullAsync(): Promise<void> {
    await using folder = await SupportedTargetsTests.createAppAsync(JSON.stringify({ desktop: {} }));

    const targets = await SupportedTargets.readAsync(folder.path);

    Assert.isNull(targets);
  }

  @TestMethod
  public async refusesAnUnreadableManifestOrAListThatIsNotDistinctKnownTargetsAsync(): Promise<void> {
    const manifests = [
      "{",
      JSON.stringify({}),
      JSON.stringify({ desktop: { supportedTargets: "linux-x64" } }),
      JSON.stringify({ desktop: { supportedTargets: ["linux-x64", "linux-x64"] } }),
      JSON.stringify({ desktop: { supportedTargets: ["linux-riscv"] } }),
      JSON.stringify({ desktop: { supportedTargets: [64] } })
    ];
    for (const manifest of manifests) {
      await using folder = await SupportedTargetsTests.createAppAsync(manifest);

      const error = await Assert.throwsAsync(() => SupportedTargets.readAsync(folder.path), BuildException);

      Assert.isTrue(error.message.startsWith("The root package.json's desktop.supportedTargets must list distinct targets among "), `${manifest}: ${error.message}`);
    }
  }

  private static async createAppAsync(manifest: string): Promise<{ readonly path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-supported-targets-"));
    await writeFile(path.join(folder, "package.json"), manifest);
    return {
      path: folder,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    };
  }
}
