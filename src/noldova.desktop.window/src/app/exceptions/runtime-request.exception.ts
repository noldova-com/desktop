/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { WindowException } from "./window.exception.js";

export class RuntimeRequestException extends WindowException {
  public override readonly name: string = "RuntimeRequestException";
  public readonly code: string;
  public readonly details: JsonObject | undefined;

  public constructor(code: string, message: string, details?: JsonObject) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
