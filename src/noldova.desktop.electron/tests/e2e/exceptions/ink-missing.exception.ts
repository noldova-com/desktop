/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class InkMissingException extends installedElectron.ElectronException {
  public constructor() {
    super("The element holds no ink before its later part.");
  }
}
