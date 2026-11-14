/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { ProductIdentity } from "../../models/packages/product-identity.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { ReleaseSettings } from "./release-settings.ts";
import { Resources } from "../../resources.ts";

export class ReleaseSigning {
  private readonly platforms: readonly string[];

  private constructor(platforms: readonly string[]) {
    this.platforms = platforms;
  }

  public static async readAsync(root: string): Promise<ReleaseSigning> {
    const settings = await ReleaseSettings.readAsync(root, Resources.signedPlatformsInvalid);
    const value = settings.hasField(Resources.signedPlatformsField) ? settings.readValue(Resources.signedPlatformsField) : [];
    if (!Array.isArray(value))
      throw new BuildException(Resources.signedPlatformsInvalid);
    const platforms: readonly unknown[] = value;
    if (new Set(platforms).size !== platforms.length || !platforms.every(t => Object.isString(t) && Resources.signablePlatforms.includes(t)))
      throw new BuildException(Resources.signedPlatformsInvalid);
    return new ReleaseSigning(Resources.signablePlatforms.filter(t => platforms.includes(t)));
  }

  public listSignedPlatforms(product: ProductIdentity, repository: string): readonly string[] {
    if (!product.isReleaseRepository(repository))
      return [];
    const unsigned = Resources.signablePlatforms.filter(t => !this.platforms.includes(t));
    if (unsigned.length > 0)
      throw new BuildException(Resources.formatUpdateFeedNeedsSigning(repository, product.name, unsigned));
    return this.platforms;
  }
}
