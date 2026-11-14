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

export abstract class ConnectionException extends RuntimeException {
  public readonly failure: Failure | null;

  protected constructor(message: string, failure: Failure | null, options?: ExceptionOptions) {
    super(message, options);

    this.failure = failure;
  }
}
