/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ElectronDistribution } from "../../../src/services/packaging/electron-distribution.js";
import { FolderFixture } from "../../fixtures/folder.fixture.js";

@TestClass
export class ElectronDistributionTests {
  @TestMethod
  public async readsElectronsVersionFromItsManifest(): Promise<void> {
    await using folder = await ElectronDistributionTests.createFolderAsync();
    await ElectronDistributionTests.writeAsync(folder.path, "node_modules/electron/package.json", JSON.stringify({ name: "electron", version: "44.9.1" }));

    const version = await new ElectronDistribution(folder.path, path.join(folder.path, "copy")).readVersionAsync();

    Assert.areEqual("44.9.1", version);
  }

  @TestMethod
  public async refusesAManifestWithoutAVersion(): Promise<void> {
    await using folder = await ElectronDistributionTests.createFolderAsync();
    await ElectronDistributionTests.writeAsync(folder.path, "node_modules/electron/package.json", JSON.stringify({ name: "electron" }));
    const manifest = path.join(folder.path, "node_modules", "electron", "package.json");

    const error = await Assert.throwsAsync(() => new ElectronDistribution(folder.path, path.join(folder.path, "copy")).readVersionAsync(), BuildException);

    Assert.areEqual(`${manifest} has no version for Electron.`, error.message);
    Assert.isDefined(error.cause);
  }

  @TestMethod
  public async copiesTheDistributionWithoutItsVersionFileAndDefaultAppOverAnEarlierCopy(): Promise<void> {
    await using folder = await ElectronDistributionTests.createFolderAsync();
    await ElectronDistributionTests.writeAsync(folder.path, "node_modules/electron/dist/electron", "binary");
    await ElectronDistributionTests.writeAsync(folder.path, "node_modules/electron/dist/version", "44.9.1");
    await ElectronDistributionTests.writeAsync(folder.path, "node_modules/electron/dist/resources/default_app.asar", "default");
    await ElectronDistributionTests.writeAsync(folder.path, "node_modules/electron/dist/resources/locale.pak", "locale");
    await ElectronDistributionTests.writeAsync(folder.path, "copy/stale", "stale");
    const distribution = new ElectronDistribution(folder.path, path.join(folder.path, "copy"));

    await distribution.copyAsync();

    Assert.areEqual("binary", await readFile(path.join(distribution.folder, "electron"), "utf8"));
    Assert.areEqual("locale", await readFile(path.join(distribution.folder, "resources", "locale.pak"), "utf8"));
    Assert.isFalse(existsSync(path.join(distribution.folder, "version")));
    Assert.isFalse(existsSync(path.join(distribution.folder, "resources", "default_app.asar")));
    Assert.isFalse(existsSync(path.join(distribution.folder, "stale")));
  }

  private static async writeAsync(folder: string, file: string, text: string): Promise<void> {
    const target = path.join(folder, ...file.split("/"));
    await FolderFixture.ensureAsync(path.dirname(target));
    await writeFile(target, text);
  }

  private static async createFolderAsync(): Promise<{ path: string } & AsyncDisposable> {
    const folder = await mkdtemp(path.join(tmpdir(), "electron-distribution-"));
    return { path: folder, [Symbol.asyncDispose]: () => rm(folder, { recursive: true, force: true }) };
  }
}
