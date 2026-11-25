/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class MainProcessSilentException extends installedElectron.ElectronException {
  public readonly silentSince: string;
  public readonly action: string;

  public constructor(silentSince: string, action: string) {
    super(`The main process has not answered since it was asked to ${silentSince}, so the test did not wait for it to ${action}.`);

    this.silentSince = silentSince;
    this.action = action;
  }
}
