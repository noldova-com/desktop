/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class WaitTimedOutException extends installedElectron.ElectronException {
  public readonly description: string;
  public readonly milliseconds: number;

  public constructor(description: string, milliseconds: number) {
    super(`Waited ${milliseconds} ms for ${description}, but it did not happen.`);

    this.description = description;
    this.milliseconds = milliseconds;
  }
}
