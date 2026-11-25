/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class BusAddressMissingException extends ElectronException {
  public readonly daemon: string;

  public constructor(daemon: string) {
    super(`${daemon} ended before it printed its address.`);

    this.daemon = daemon;
  }
}
