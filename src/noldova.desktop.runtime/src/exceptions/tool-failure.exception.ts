/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import type { ToolFailure } from "../models/tool-failure.js";
import { RuntimeException } from "./runtime.exception.js";

export class ToolFailureException extends RuntimeException {
  public readonly failure: ToolFailure;

  public constructor(failure: ToolFailure, options?: ExceptionOptions) {
    super(failure.message, options);

    this.failure = failure;
  }
}
