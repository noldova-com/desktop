/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ToolFailureCode } from "../enums/tool-failure-code.js";

export class ToolAbortOutcome {
  public readonly code: ToolFailureCode;
  public readonly message: string;

  public constructor(code: ToolFailureCode, message: string) {
    this.code = code;
    this.message = message;
  }
}
