/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PackageManifest } from "../packages/package-manifest.ts";

export class ShippedPackages {
  public readonly packages: readonly PackageManifest[];
  public readonly installed: readonly string[];

  public constructor(packages: readonly PackageManifest[], installed: readonly string[]) {
    this.packages = packages;
    this.installed = installed;
  }
}
