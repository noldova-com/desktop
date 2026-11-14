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

import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { Resources } from "../../resources.ts";

export class AboutLogo {
  private readonly icons: string;
  private readonly light: string;

  private constructor(icons: string, light: string) {
    this.icons = icons;
    this.light = light;
  }

  public static of(root: string, product: ProductIdentity): AboutLogo | null {
    const icons = path.join(root, ...product.icons.split(Resources.aboutLogoSeparator));
    if (!existsSync(path.join(icons, Resources.linuxIconFile)))
      return null;
    return new AboutLogo(icons, existsSync(path.join(icons, Resources.aboutLogoLightFile)) ? Resources.aboutLogoLightFile : Resources.linuxIconFile);
  }

  public toJson(): Readonly<Record<string, string>> {
    return { light: AboutLogo.address(this.light), dark: AboutLogo.address(Resources.linuxIconFile) };
  }

  public async copyAsync(windowFolder: string): Promise<void> {
    const folder = path.join(windowFolder, Resources.windowBrowserFolder, Resources.aboutLogoFolder);
    await mkdir(folder, { recursive: true });
    for (const file of new Set([this.light, Resources.linuxIconFile]))
      await copyFile(path.join(this.icons, file), path.join(folder, file));
  }

  private static address(file: string): string {
    return [Resources.aboutLogoFolder, file].join(Resources.aboutLogoSeparator);
  }
}
