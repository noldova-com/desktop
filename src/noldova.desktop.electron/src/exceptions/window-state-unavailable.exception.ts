/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { WindowStateException } from "./window-state.exception.js";

export abstract class WindowStateUnavailableException extends WindowStateException {
  protected constructor(message: string, options?: ExceptionOptions) {
    super(message, options);
  }
}
