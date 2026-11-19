/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { MessageBoxOptions, MessageBoxReturnValue, OpenDialogOptions, OpenDialogReturnValue, SaveDialogOptions, SaveDialogReturnValue } from "electron";

import type { IDialogHost } from "@noldova/desktop.electron";

export class FakeDialogHost implements IDialogHost {
  public readonly answers: number[];
  public readonly boxes: { windowId: number | null; options: MessageBoxOptions }[] = [];
  public failure: Error | null = null;
  public isAppReady: () => boolean = () => true;
  public readonly pendingBoxes: ((result: MessageBoxReturnValue) => void)[] = [];
  public readonly openDialogs: { windowId: number; options: OpenDialogOptions; answer: (result: OpenDialogReturnValue) => void }[] = [];
  public readonly saveDialogs: { windowId: number; options: SaveDialogOptions; answer: (result: SaveDialogReturnValue) => void }[] = [];

  public constructor(answers: readonly number[] = []) {
    this.answers = [...answers];
  }

  public showMessageBox(windowId: number | null, options: MessageBoxOptions): Promise<MessageBoxReturnValue> {
    if (!this.isAppReady())
      return Promise.reject(new Error("A message box can't show before the app is ready."));
    this.boxes.push({ windowId, options });
    if (!Object.isNull(this.failure))
      return Promise.reject(this.failure);
    const answer = this.answers.shift();
    if (!Object.isUndefined(answer))
      return Promise.resolve({ response: answer, checkboxChecked: false });
    return new Promise(resolve => {
      this.pendingBoxes.push(resolve);
      options.signal?.addEventListener("abort", () => resolve({ response: options.cancelId ?? 0, checkboxChecked: false }));
    });
  }

  public showOpenDialog(windowId: number, options: OpenDialogOptions): Promise<OpenDialogReturnValue> {
    return new Promise(resolve => this.openDialogs.push({ windowId, options, answer: resolve }));
  }

  public showSaveDialog(windowId: number, options: SaveDialogOptions): Promise<SaveDialogReturnValue> {
    return new Promise(resolve => this.saveDialogs.push({ windowId, options, answer: resolve }));
  }
}
