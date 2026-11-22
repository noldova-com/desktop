/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class StoredSetting {
  public readonly value: JsonValue;
  public readonly isOwn: boolean;

  public constructor(value: JsonValue, isOwn: boolean) {
    this.value = value;
    this.isOwn = isOwn;
  }
}
