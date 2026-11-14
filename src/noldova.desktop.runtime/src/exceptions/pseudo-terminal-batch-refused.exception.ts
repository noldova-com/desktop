/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { ProcessStartException } from "./process-start.exception.js";

export class PseudoTerminalBatchRefusedException extends ProcessStartException {
  public readonly program: string;

  public constructor(program: string) {
    super(Resources.formatPseudoTerminalBatchRefused(program));

    this.program = program;
  }
}
