/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class AppProcessesNotExitedException extends installedElectron.ElectronException {
  public readonly processes: string;
  public readonly seconds: number;
  public readonly root: string;

  public constructor(processes: string, seconds: number, root: string) {
    super(`Noldova Desktop Sample's processes ${processes} still run ${seconds} s after it closed, so its folder ${root} is kept.`);

    this.processes = processes;
    this.seconds = seconds;
    this.root = root;
  }
}
