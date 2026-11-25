/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { LockedPackage } from "./locked-package.ts";

export class FoundPackage {
  public readonly locked: LockedPackage;
  public readonly entry: JsonObject;

  public constructor(locked: LockedPackage, entry: JsonObject) {
    this.locked = locked;
    this.entry = entry;
  }
}
