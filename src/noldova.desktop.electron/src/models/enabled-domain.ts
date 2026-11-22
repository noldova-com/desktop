/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export class EnabledDomain {
  public readonly method: string;
  public readonly params: JsonObject;
  public replaced: EnabledDomain | null;

  public constructor(method: string, params: JsonObject, replaced: EnabledDomain | null) {
    this.method = method;
    this.params = params;
    this.replaced = replaced;
  }
}
