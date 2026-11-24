/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class DiscoveryFileMissingException extends ElectronException {
  public readonly dataDirectory: string;

  public constructor(dataDirectory: string) {
    super(`No runtime discovery file was found in ${dataDirectory}, so the test could not tell which connection to reach.`);

    this.dataDirectory = dataDirectory;
  }
}
