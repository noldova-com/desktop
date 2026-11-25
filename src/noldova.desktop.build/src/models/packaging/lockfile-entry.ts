/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export class LockfileEntry {
  public readonly location: string;
  public readonly entry: JsonObject;
  public readonly isInstalled: boolean;

  public constructor(location: string, entry: JsonObject, isInstalled: boolean) {
    this.location = location;
    this.entry = entry;
    this.isInstalled = isInstalled;
  }
}
