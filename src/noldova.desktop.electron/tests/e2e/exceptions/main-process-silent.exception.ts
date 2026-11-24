/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class MainProcessSilentException extends ElectronException {
  public readonly silentSince: string;
  public readonly action: string;

  public constructor(silentSince: string, action: string) {
    super(`The main process has not answered since it was asked to ${silentSince}, so the test did not wait for it to ${action}.`);

    this.silentSince = silentSince;
    this.action = action;
  }
}
