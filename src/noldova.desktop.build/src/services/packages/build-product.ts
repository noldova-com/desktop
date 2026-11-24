/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import type { BuildVariant } from "../../models/modules/build-variant.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import { FolderCreation } from "../files/folder-creation.ts";
import { Resources } from "../../resources.ts";

export class BuildProduct {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public async writeAsync(fingerprint: string, outputFolder: string | null, variant: BuildVariant): Promise<void> {
    const manifest = await RootManifest.readAsync(this.root);
    const product = await ProductIdentity.readAsync(this.root);
    const document = {
      name: product.name,
      slug: product.slug,
      applicationId: product.applicationId,
      developmentApplicationId: product.developmentApplicationId,
      dataFolder: product.dataFolder,
      deviceFolders: { windows: product.windowsDeviceFolder, macos: product.macosDeviceFolder, linux: product.linuxDeviceFolder },
      dataDirectoryVariable: product.dataDirectoryVariable,
      icons: product.icons,
      windowsPublisher: null,
      ...Object.isNull(product.permissionsModule) ? {} : { permissionsModule: product.permissionsModule },
      ...Object.isNull(product.installFolder) ? {} : { installFolder: product.installFolder },
      updateFeed: Object.isNull(outputFolder) ? null : variant.isPackaged ? variant.updateFeed ?? product.updateFeed : variant.updateFeed,
      version: manifest.productVersion,
      build: fingerprint
    };
    const file = this.locate(outputFolder);
    await FolderCreation.createAsync(path.dirname(file));
    await writeFile(file, Resources.formatJsonFile(document));
  }

  public static async setWindowsPublisherAsync(outputFolder: string, publisher: string): Promise<void> {
    const file = path.join(outputFolder, Resources.productFile);
    const document = JsonReader.parse(await readFile(file, Resources.textEncoding)).toJson();
    await writeFile(file, Resources.formatJsonFile({ ...document, windowsPublisher: publisher }));
  }

  public static async setLinuxUpdateKeysAsync(outputFolder: string, keys: readonly string[]): Promise<void> {
    const file = path.join(outputFolder, Resources.productFile);
    const document = JsonReader.parse(await readFile(file, Resources.textEncoding)).toJson();
    await writeFile(file, Resources.formatJsonFile({ ...document, [Resources.productLinuxUpdateKeysField]: keys }));
  }

  private locate(outputFolder: string | null): string {
    return Object.isNull(outputFolder) ? path.join(this.root, ...Resources.productBuildFileSegments) : path.join(outputFolder, Resources.productFile);
  }
}
