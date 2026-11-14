/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { CliException } from "./cli.exception.js";

export class CliCommandException extends CliException {
  public readonly code: string;
  public readonly details: JsonObject | null;

  public constructor(code: string, message: string, details: JsonObject | null = null) {
    super(message);
    ArgumentException.throwIfNullOrWhitespace(code, Resources.codeParameterName);
    this.code = code;
    this.details = details;
  }
}
