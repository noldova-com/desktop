/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";
import type { Failure } from "@noldova/desktop.protocol";

import { RuntimeException } from "./runtime.exception.js";

export class MethodFailureException extends RuntimeException {
  public readonly failure: Failure;

  public constructor(failure: Failure, options?: ExceptionOptions) {
    super(failure.message, options);

    this.failure = failure;
  }
}
