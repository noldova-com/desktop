/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { WindowException } from "./window.exception.js";

export abstract class WindowPartFailureException extends WindowException {
  public override readonly name: string = "WindowPartFailureException";
  public readonly moduleId: string;

  protected constructor(message: string, moduleId: string, options?: ExceptionOptions) {
    super(message, options);

    this.moduleId = moduleId;
  }
}
