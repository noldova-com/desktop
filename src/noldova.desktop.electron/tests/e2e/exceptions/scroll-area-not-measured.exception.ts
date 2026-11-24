/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class ScrollAreaNotMeasuredException extends ElectronException {
  public readonly measure: string;

  public constructor(measure: string) {
    super(`No scroll area was measured for its ${measure}.`);

    this.measure = measure;
  }
}
