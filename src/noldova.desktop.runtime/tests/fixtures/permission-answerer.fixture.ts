/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IPermissionAnswerer, PermissionDecision, type PermissionQuestion } from "@noldova/desktop.runtime";

export class PermissionAnswererFixture implements IPermissionAnswerer {
  private readonly answer: (question: PermissionQuestion, signal: AbortSignal) => Promise<PermissionDecision>;
  private readonly arrivals: (() => void)[] = [];

  public readonly questions: PermissionQuestion[] = [];
  public readonly signals: AbortSignal[] = [];

  public constructor(answer: (question: PermissionQuestion, signal: AbortSignal) => Promise<PermissionDecision> = () => Promise.resolve(PermissionDecision.AllowedOnce)) {
    this.answer = answer;
  }

  public static never(): Promise<PermissionDecision> {
    return new Promise(() => undefined);
  }

  public answerAsync(question: PermissionQuestion, signal: AbortSignal): Promise<PermissionDecision> {
    this.questions.push(question);
    this.signals.push(signal);
    for (const arrived of this.arrivals.splice(0))
      arrived();
    return this.answer(question, signal);
  }

  public waitForQuestionAsync(count: number): Promise<void> {
    return new Promise(resolve => {
      const check = (): void => {
        if (this.questions.length >= count)
          resolve();
        else
          this.arrivals.push(check);
      };
      check();
    });
  }
}
