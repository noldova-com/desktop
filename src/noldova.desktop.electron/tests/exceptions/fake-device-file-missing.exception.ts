/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class FakeDeviceFileMissingException extends ElectronException {
  public readonly fileName: string;

  public constructor(fileName: string) {
    super(`No fake device file is named ${fileName}.`);

    this.fileName = fileName;
  }
}
