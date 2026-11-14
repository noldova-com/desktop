/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";
import type { Failure } from "@noldova/desktop.protocol";

import { MethodFailureException } from "./method-failure.exception.js";

export abstract class SettingException extends MethodFailureException {
  protected constructor(failure: Failure, options?: ExceptionOptions) {
    super(failure, options);
  }
}
