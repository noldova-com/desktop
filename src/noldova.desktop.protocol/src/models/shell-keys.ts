/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { KeyChord } from "./key-chord.js";

export class ShellKeys {
  public static readonly stopAgentControl: KeyChord = KeyChord.parse(Resources.stopAgentControlKey);

  public static list(platform: string): readonly (readonly [KeyChord, string])[] {
    return ShellKeys.parse(Resources.shellKeys, platform);
  }

  public static pageFirst(platform: string): readonly (readonly [KeyChord, string])[] {
    return ShellKeys.parse(Resources.pageFirstShellKeys, platform);
  }

  public static declarable(platform: string): readonly (readonly [KeyChord, string])[] {
    return ShellKeys.parse(Resources.declarableShellKeys, platform);
  }

  public static has(key: KeyChord, platform: string): boolean {
    return [...ShellKeys.list(platform).map(t => t[0]), ShellKeys.stopAgentControl].some(t => t.isSameOn(key, platform));
  }

  private static parse(keys: readonly (readonly [string, readonly string[], readonly string[]])[], platform: string): readonly (readonly [KeyChord, string])[] {
    const isMac = platform === Resources.macPlatform;
    return keys.flatMap(([command, standard, mac]) => (isMac ? mac : standard).map(t => [KeyChord.parse(t), command] as const));
  }
}
