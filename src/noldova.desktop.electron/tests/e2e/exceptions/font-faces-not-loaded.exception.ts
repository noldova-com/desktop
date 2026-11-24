/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class FontFacesNotLoadedException extends ElectronException {
  public readonly faces: readonly string[];

  public constructor(faces: readonly string[]) {
    super(`The window's font faces did not load: ${faces.join(", ")}.`);

    this.faces = faces;
  }
}
