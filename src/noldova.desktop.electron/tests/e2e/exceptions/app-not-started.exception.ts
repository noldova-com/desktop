/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class AppNotStartedException extends ElectronException {
  public constructor() {
    super("Noldova Desktop Sample was not started.");
  }
}
