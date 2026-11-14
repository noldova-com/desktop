/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import type { ConnectionException } from "@noldova/desktop.runtime";

import { WindowStateUnavailableException } from "./window-state-unavailable.exception.js";

export class WindowStateRuntimeUnreachableException extends WindowStateUnavailableException {
  public constructor(cause: ConnectionException) {
    super(cause.message, new ExceptionOptions(cause));
  }
}
