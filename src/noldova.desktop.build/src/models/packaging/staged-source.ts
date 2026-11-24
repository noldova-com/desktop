/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PackageSource } from "./package-source.ts";

export class StagedSource {
  public readonly id: string;
  public readonly license: string;
  public readonly source: PackageSource;

  public constructor(id: string, license: string, source: PackageSource) {
    this.id = id;
    this.license = license;
    this.source = source;
  }
}
