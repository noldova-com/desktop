/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IQuitPrompt, QuitQuestion } from "@noldova/desktop.electron";

export class FakeQuitPrompt implements IQuitPrompt {
  public readonly shown: string[] = [];
  public canShow: boolean = true;

  public show(question: QuitQuestion | null): boolean {
    this.shown.push(Object.isNull(question) ? "none" : `${question.descriptions.join("+")}${question.isWaiting ? " waiting" : String.empty}${question.isUpdate ? " update" : String.empty}`);
    return this.canShow;
  }
}
