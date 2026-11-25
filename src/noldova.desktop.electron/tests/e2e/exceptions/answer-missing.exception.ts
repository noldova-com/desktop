/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { installedElectron } from "../fixtures/installed-electron.fixture.ts";

export class AnswerMissingException extends installedElectron.ElectronException {
  public readonly milliseconds: number;

  public constructor(milliseconds: number) {
    super(`No answer within ${milliseconds} ms.`);

    this.milliseconds = milliseconds;
  }
}
