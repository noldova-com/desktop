/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class ProcessesNotKilledException extends installedElectron.ElectronException {
  public readonly processIds: readonly number[];
  public readonly seconds: number;
  public readonly keptFolder: string | null;

  public constructor(processIds: readonly number[], seconds: number, keptFolder: string | null) {
    super(`Processes ${processIds.join(", ")} still ran ${seconds} s after they were killed${Object.isNull(keptFolder) ? String.empty : `, so ${keptFolder} is kept`}.`);

    this.processIds = processIds;
    this.seconds = seconds;
    this.keptFolder = keptFolder;
  }
}
