/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class FontFacesMissingException extends installedElectron.ElectronException {
  public constructor() {
    super("The window declares no font face, so its text would be measured in fallback fonts.");
  }
}
