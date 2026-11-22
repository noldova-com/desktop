/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KeyboardInputEvent } from "electron";

export class WebViewKeyModifier {
  public readonly flag: number;
  public readonly name: NonNullable<KeyboardInputEvent["modifiers"]>[number];

  public constructor(flag: number, name: NonNullable<KeyboardInputEvent["modifiers"]>[number]) {
    this.flag = flag;
    this.name = name;
  }

  public isIn(flags: number): boolean {
    return (flags & this.flag) !== 0;
  }
}
