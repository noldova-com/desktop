/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { ProcessStartException } from "./process-start.exception.js";

export class BatchArgumentRefusedException extends ProcessStartException {
  public readonly program: string;

  public constructor(program: string) {
    super(Resources.formatBatchArgumentRefused(program));

    this.program = program;
  }
}
