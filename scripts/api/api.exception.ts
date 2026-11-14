/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { ScriptException } from "../script.exception.ts";

export class ApiException extends ScriptException {
  protected constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }

  public static describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
