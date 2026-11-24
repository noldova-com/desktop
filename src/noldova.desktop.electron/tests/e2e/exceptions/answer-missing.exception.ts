/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class AnswerMissingException extends ElectronException {
  public readonly milliseconds: number;

  public constructor(milliseconds: number) {
    super(`No answer within ${milliseconds} ms.`);

    this.milliseconds = milliseconds;
  }
}
