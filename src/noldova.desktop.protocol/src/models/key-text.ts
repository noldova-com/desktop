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
    if (platform !== Resources.macPlatform)
      return chord.label(platform);
    const names = [[chord.hasCtrl, Resources.macControlName], [chord.hasAlt, Resources.macOptionName], [chord.hasShift, Resources.shiftLabel], [chord.hasMod, Resources.macCommandName]] as const;
    return [...names.filter(t => t[0]).map(t => t[1]), chord.key.label(false)].join(Resources.keySeparator);
  }
}
