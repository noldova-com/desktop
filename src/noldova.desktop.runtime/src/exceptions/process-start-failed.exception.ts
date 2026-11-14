/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { ProcessStartException } from "./process-start.exception.js";

export class ProcessStartFailedException extends ProcessStartException {
  public readonly program: string;

  public constructor(program: string, options?: ExceptionOptions) {
    super(Resources.formatProcessStartFailed(program), options);

    this.program = program;
  }
}
