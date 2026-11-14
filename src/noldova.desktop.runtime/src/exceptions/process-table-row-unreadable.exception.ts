/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { SystemCommandException } from "./system-command.exception.js";

export class ProcessTableRowUnreadableException extends SystemCommandException {
  public readonly row: string;

  public constructor(row: string) {
    super(Resources.formatProcessTableRowUnreadable(row));

    this.row = row;
  }
}
