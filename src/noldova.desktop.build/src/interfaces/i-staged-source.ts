/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PackageSource } from "../models/packaging/package-source.ts";

export interface IStagedSource {
  readonly id: string;
  readonly license: string;
  readonly source: PackageSource;
}
