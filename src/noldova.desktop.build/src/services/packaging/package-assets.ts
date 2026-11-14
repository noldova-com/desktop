/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackageAssets {
  private static readonly DEFAULTS: string = fileURLToPath(new URL(Resources.packageAssetsDefaultsUrl, import.meta.url));

  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public locate(segments: readonly string[]): string {
    const own = path.join(this.root, ...segments);
    return existsSync(own) ? own : path.join(PackageAssets.DEFAULTS, ...segments);
  }

  public list(segments: readonly string[]): readonly string[] {
    return [path.join(this.root, ...segments), path.join(PackageAssets.DEFAULTS, ...segments)];
  }

  public require(segments: readonly string[], role: string): string {
    const own = path.join(this.root, ...segments);
    if (!existsSync(own))
      throw new BuildException(Resources.formatPackageAssetMissing(segments, role));
    return own;
  }
}
