/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class NoProgramWaitingException extends ElectronException {
  public constructor() {
    super("No program is waiting for an answer.");
  }
}
