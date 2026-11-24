/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class RuntimeNotStoppedException extends ElectronException {
  public readonly processId: number;
  public readonly seconds: number;
  public readonly answer: string;

  public constructor(processId: number, seconds: number, answer: string) {
    super(`The runtime ${processId} still ran ${seconds} s after it was asked to stop (${answer}), so the test killed it.`);

    this.processId = processId;
    this.seconds = seconds;
    this.answer = answer;
  }
}
