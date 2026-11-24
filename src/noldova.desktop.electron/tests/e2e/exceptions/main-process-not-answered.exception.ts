/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class MainProcessNotAnsweredException extends ElectronException {
  public readonly seconds: number;
  public readonly action: string;
  public readonly lastAnswer: string;
  public readonly failures: string;
  public readonly placement: string;

  public constructor(seconds: number, action: string, lastAnswer: string, failures: string, placement: string) {
    super([
      `The main process did not answer within ${seconds} s when asked to ${action}.`,
      lastAnswer,
      failures,
      placement
    ].join("\n"));

    this.seconds = seconds;
    this.action = action;
    this.lastAnswer = lastAnswer;
    this.failures = failures;
    this.placement = placement;
  }
}
