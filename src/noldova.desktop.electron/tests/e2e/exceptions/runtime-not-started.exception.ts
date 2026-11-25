/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class RuntimeNotStartedException extends installedElectron.ElectronException {
  public readonly reason: string;
  public readonly lock: string;
  public readonly naming: string;
  public readonly processorLoad: string;

  public constructor(reason: string, lock: string, naming: string, processorLoad: string) {
    super(`Noldova Desktop Sample's runtime did not start: ${reason}. The data directory's lock was ${lock}. Processes naming the data directory: ${naming}. Processor load: ${processorLoad}.`);

    this.reason = reason;
    this.lock = lock;
    this.naming = naming;
    this.processorLoad = processorLoad;
  }
}
