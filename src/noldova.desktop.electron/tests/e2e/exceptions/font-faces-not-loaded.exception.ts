/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class FontFacesNotLoadedException extends installedElectron.ElectronException {
  public readonly faces: readonly string[];

  public constructor(faces: readonly string[]) {
    super(`The window's font faces did not load: ${faces.join(", ")}.`);

    this.faces = faces;
  }
}
