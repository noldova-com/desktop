/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class UpdatePackageUndefinedException extends installedElectron.ElectronException {
  public readonly platform: string;
  public readonly architecture: string;

  public constructor(platform: string, architecture: string) {
    super(`No update package is defined for ${platform} ${architecture}.`);

    this.platform = platform;
    this.architecture = architecture;
  }
}
