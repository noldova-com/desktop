/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, type ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class ModuleActivationException extends RuntimeException {
  public constructor(message: string, options?: ExceptionOptions) {
    ArgumentException.throwIfNullOrWhitespace(message, Resources.messageParameterName);
    super(message, options);
  }
}
