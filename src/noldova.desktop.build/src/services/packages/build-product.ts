/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import type { BuildVariant } from "../../models/modules/build-variant.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import type { ProductTrayItem } from "../../models/packages/product-tray-item.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
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
      ...Object.isNull(product.tray) ? {} : { tray: await Promise.all(product.tray.map((t, index) => this.formatTrayItemAsync(t, index))) },
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

  private async formatTrayItemAsync(entry: ProductTrayItem, index: number): Promise<Readonly<Record<string, unknown>>> {
    if (entry.isSeparator)
      return { [Resources.productTraySeparatorField]: true };
    const icon = entry.icon;
    return {
      ...Object.isNull(entry.item) ? {} : { [Resources.productTrayItemField]: entry.item },
      ...Object.isNull(entry.text) ? {} : { [Resources.productTrayTextField]: entry.text },
      ...Object.isNull(entry.toggledText) ? {} : { [Resources.productTrayToggledTextField]: entry.toggledText },
      ...Object.isNull(entry.command) ? {} : { [Resources.productTrayCommandField]: entry.command },
      ...Object.isNull(icon) ? {} : { [Resources.productTrayIconField]: await this.readIconAsync(icon, Resources.formatTrayFieldPath(index, Resources.productTrayIconField)) },
      ...Object.isNull(entry.iconDark) ? {} : {
        [Resources.productTrayIconDarkField]: await this.readIconAsync(entry.iconDark, Resources.formatTrayFieldPath(index, Resources.productTrayIconDarkField))
      },
      ...BuildProduct.isTemplate(icon) ? { [Resources.productTrayIsTemplateField]: true } : {}
    };
  }

  private static isTemplate(icon: string | null): boolean {
    return !Object.isNull(icon) && !Resources.productTrayIconDataPattern.test(icon) && path.basename(icon, path.extname(icon)).endsWith(Resources.productTrayTemplateSuffix);
  }

  private async readIconAsync(icon: string, field: string): Promise<string> {
    if (Resources.productTrayIconDataPattern.test(icon))
      return icon;
    const file = path.join(this.root, ...icon.split(Resources.pathSegmentSeparator));
    if (!existsSync(file))
      throw new BuildException(Resources.formatTrayIconMissing(field, icon));
    return Resources.formatIconDataUrl(await readFile(file));
  }

  private locate(outputFolder: string | null): string {
    return Object.isNull(outputFolder) ? path.join(this.root, ...Resources.productBuildFileSegments) : path.join(outputFolder, Resources.productFile);
  }
}
