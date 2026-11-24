/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class UiRunIdInvalidException extends installedElectron.ElectronException {
  public readonly id: string;

  public constructor(id: string) {
    super(`${id} is not a UI run's id, which is its runner's process id and start time.`);

    this.id = id;
  }
}
