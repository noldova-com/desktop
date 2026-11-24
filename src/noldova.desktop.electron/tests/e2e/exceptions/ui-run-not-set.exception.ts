/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class UiRunNotSetException extends ElectronException {
  public readonly variable: string;

  public constructor(variable: string) {
    super(`${variable} is not set, so this run's global setup, fixtures/run-setup.ts, did not run.`);

    this.variable = variable;
  }
}
