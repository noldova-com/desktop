/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { SystemCommandException } from "./system-command.exception.js";

export class ForegroundGroupUnreadableException extends SystemCommandException {
  public readonly processId: number;
  public readonly output: string;

  public constructor(processId: number, output: string) {
    super(Resources.formatForegroundGroupUnreadable(processId, output));

    this.processId = processId;
    this.output = output;
  }
}
