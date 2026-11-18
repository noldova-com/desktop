/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.js";
import { KeyChord } from "./key-chord.js";

export class KeyText {
  public static check(text: string, parameterName: string): void {
    KeyText.replace(text, t => KeyChord.parse(t, parameterName).text);
  }

  public static format(text: string, platform: string): string {
    return KeyText.replace(text, t => KeyText.labelOf(KeyChord.parse(t), platform));
  }

  private static replace(text: string, replacement: (chord: string) => string): string {
    return text.replace(Resources.keyTokenPattern, (_token: string, chord: string) => replacement(chord));
  }

  private static labelOf(chord: KeyChord, platform: string): string {
    return chord.label(platform);
  }
}
