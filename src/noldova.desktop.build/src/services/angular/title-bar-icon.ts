/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProductIdentity } from "../../models/packages/product-identity.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

/** The icon an app gives its title bar: a data: URL the window shows as it is, or a file in the app's tree that the build copies beside the window's files. */
export class TitleBarIcon {
  public readonly address: string;
  private readonly file: string | null;

  private constructor(address: string, file: string | null) {
    this.address = address;
    this.file = file;
  }

  /** The app's title bar icon, or null when it gives none; a file the app names but doesn't have stops the build. */
  public static of(root: string, product: ProductIdentity): TitleBarIcon | null {
    const icon = product.titleBarIcon;
    if (Object.isNull(icon))
      return null;
    if (Resources.productTitleBarIconDataPattern.test(icon))
      return new TitleBarIcon(icon, null);
    const file = path.join(root, ...icon.split(Resources.pathSegmentSeparator));
    if (!existsSync(file))
      throw new BuildException(Resources.formatTitleBarIconMissing(icon));
    return new TitleBarIcon([Resources.titleBarIconFolder, encodeURIComponent(path.basename(file))].join(Resources.pathSegmentSeparator), file);
  }

  /** Copies a file icon into the built window's `browser/title-bar/`; a data: URL needs no file. */
  public async copyAsync(windowFolder: string): Promise<void> {
    if (Object.isNull(this.file))
      return;
    const folder = path.join(windowFolder, Resources.windowBrowserFolder, Resources.titleBarIconFolder);
    await mkdir(folder, { recursive: true });
    await copyFile(this.file, path.join(folder, path.basename(this.file)));
  }
}
