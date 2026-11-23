/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

export class ToolbarBandPage {
  public readonly band: string;
  public readonly context: JsonObject;

  public constructor(band: string, context: JsonObject) {
    this.band = band;
    this.context = context;
  }
}
