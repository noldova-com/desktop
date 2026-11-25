/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class ScrollAreaNotMeasuredException extends installedElectron.ElectronException {
  public readonly measure: string;

  public constructor(measure: string) {
    super(`No scroll area was measured for its ${measure}.`);

    this.measure = measure;
  }
}
