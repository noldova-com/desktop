/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class RuntimeOwnerUnknownException extends installedElectron.ElectronException {
  public readonly dataDirectory: string;
  public readonly seconds: number;

  public constructor(dataDirectory: string, seconds: number) {
    super(`A runtime still owned ${dataDirectory} ${seconds} s after the test found it stopping, and no discovery file named a running process.`);

    this.dataDirectory = dataDirectory;
    this.seconds = seconds;
  }
}
