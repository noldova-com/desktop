/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class TerminalSize {
  public static check(columns: number, rows: number): void {
    if (!Number.isInteger(columns) || columns < 1)
      throw new ArgumentException(Resources.terminalColumnsInvalid, Resources.columnsParameterName);
    if (!Number.isInteger(rows) || rows < 1)
      throw new ArgumentException(Resources.terminalRowsInvalid, Resources.rowsParameterName);
  }
}
