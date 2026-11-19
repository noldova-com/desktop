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
  public static format(text: string, platform: string): string {
    return text.replace(Resources.keyTokenPattern, (token: string, key: string) => {
      const chord = KeyChord.find(key);
      return Object.isNull(chord) ? token : KeyText.labelOf(chord, platform);
    });
  }

  private static labelOf(chord: KeyChord, platform: string): string {
    if (platform !== Resources.macPlatform)
      return chord.label(platform);
    const names = [[chord.hasCtrl, Resources.macControlName], [chord.hasAlt, Resources.macOptionName], [chord.hasShift, Resources.shiftLabel], [chord.hasMod, Resources.macCommandName]] as const;
    return [...names.filter(t => t[0]).map(t => t[1]), chord.key.label(false)].join(Resources.keySeparator);
  }
}
