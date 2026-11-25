/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class ShortcutNotTakenException extends ElectronException {
  public readonly accelerator: string;

  public constructor(accelerator: string) {
    super(`The key ${accelerator} is not taken.`);

    this.accelerator = accelerator;
  }
}
