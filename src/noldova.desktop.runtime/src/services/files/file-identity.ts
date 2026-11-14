/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BigIntStats } from "node:fs";

import { Resources } from "../../resources.js";

export class FileIdentity {
  public static of(stats: BigIntStats): string {
    return Resources.formatFileIdentity(stats.dev, stats.ino, stats.size, stats.mtimeNs);
  }
}
