/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import type { IKeyStroke } from "../interfaces/i-key-stroke.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { KeyChord } from "./key-chord.js";
import { ShellKeys } from "./shell-keys.js";

export class WebViewKey {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.keysField, Resources.macKeysField];

  public readonly name: string;
  public readonly keys: readonly KeyChord[];
  public readonly macKeys: readonly KeyChord[];

  public constructor(name: string, keys: readonly KeyChord[], macKeys: readonly KeyChord[] = keys) {
    if (!Resources.memberPattern.test(name))
      throw new ArgumentException(Resources.webViewKeyNameInvalid, Resources.nameField);
    for (const [platform, label, chords, field] of [
      [Resources.standardPlatform, Resources.standardPlatformLabel, keys, Resources.keysField],
      [Resources.macPlatform, Resources.macPlatformLabel, macKeys, Resources.macKeysField]
    ] as const)
      WebViewKey.check(platform, label, chords, field);

    this.name = name;
    this.keys = [...keys];
    this.macKeys = [...macKeys];
  }

  public static fromJson(value: unknown, path?: string): WebViewKey {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewKey.FIELDS);
    return WireContract.create(reader, () => {
      const keys = reader.readStringArray(Resources.keysField).map(t => KeyChord.parse(t, Resources.keysField));
      return new WebViewKey(
        reader.readString(Resources.nameField),
        keys,
        reader.hasField(Resources.macKeysField) ? reader.readStringArray(Resources.macKeysField).map(t => KeyChord.parse(t, Resources.macKeysField)) : keys);
    });
  }

  public keysOn(platform: string): readonly KeyChord[] {
    return platform === Resources.macPlatform ? this.macKeys : this.keys;
  }

  public matches(stroke: IKeyStroke, platform: string): boolean {
    return this.keysOn(platform).some(t => t.matches(stroke, platform));
  }

  public toJson(): JsonObject {
    return { [Resources.nameField]: this.name, [Resources.keysField]: this.keys.map(t => t.text), [Resources.macKeysField]: this.macKeys.map(t => t.text) };
  }

  private static check(platform: string, label: string, chords: readonly KeyChord[], field: string): void {
    if (chords.length === 0 || chords.length > Resources.webViewKeyChordsLimit || chords.some((t, index) => chords.findIndex(u => u.isSameOn(t, platform)) !== index))
      throw new ArgumentException(Resources.webViewKeyChordsInvalid, field);
    const refused = chords.find(t => t.isTypingKey || ShellKeys.has(t, platform)
      || Resources.reservedKeys.some(([owner, , reserved]) => owner === platform && reserved.some(u => KeyChord.parse(u).isSameOn(t, platform))));
    if (!Object.isUndefined(refused))
      throw new ArgumentException(Resources.formatWebViewKeyRefused(refused.text, label), field);
  }
}
