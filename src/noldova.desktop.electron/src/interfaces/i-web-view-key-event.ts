/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IWebViewKeyEvent {
  readonly type: "keyDown" | "char" | "keyUp";
  readonly keyCode: string;
  readonly modifiers: readonly string[];
}
