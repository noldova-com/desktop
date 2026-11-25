/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class PageUnreachableException extends installedElectron.ElectronException {
  public constructor() {
    super("The page did not answer the silence report's request, which reaches it through the main process, so the test did not wait for it.");
  }
}
