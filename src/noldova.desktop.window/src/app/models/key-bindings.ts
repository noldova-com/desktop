/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { KeyChord, QualifiedName } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.js";
import { ShortcutBinding } from "./shortcut-binding.js";

export class KeyBindings {
  private readonly keys: ReadonlyMap<string, KeyChord | null>;

  public readonly skipped: ReadonlyMap<string, string>;

  private constructor(keys: ReadonlyMap<string, KeyChord | null>, skipped: ReadonlyMap<string, string> = new Map()) {
    this.keys = keys;
    this.skipped = skipped;
  }

  public get list(): readonly ShortcutBinding[] {
    return [...this.keys].map(([command, key]) => new ShortcutBinding(command, key));
  }

  public static fromJson(value: JsonValue | undefined): KeyBindings {
    if (Object.isUndefined(value))
      return new KeyBindings(new Map());
    if (!Object.isObject(value) || Array.isArray(value))
      return new KeyBindings(new Map(), new Map([[Resources.keyBindingsSetting, Resources.keyBindingsNotObject]]));
    const keys = new Map<string, KeyChord | null>();
    const skipped = new Map<string, string>();
    for (const [command, key] of Object.entries(value)) {
      const chord = Object.isString(key) ? KeyChord.find(key) : null;
      const reason = KeyBindings.findSkipReason(QualifiedName.find(command), key, chord);
      if (Object.isNull(reason))
        keys.set(command, chord);
      else
        skipped.set(command, reason);
    }
    return new KeyBindings(keys, skipped);
  }

  public has(command: string): boolean {
    return this.keys.has(command);
  }

  public isSameAs(other: KeyBindings): boolean {
    return this.keys.size === other.keys.size && [...this.keys].every(([command, key]) => other.keys.has(command) && other.keys.get(command)?.text === key?.text);
  }

  public with(command: string, key: KeyChord | null): KeyBindings {
    return new KeyBindings(new Map([...this.keys, [command, key]]));
  }

  public without(command: string): KeyBindings {
    return new KeyBindings(new Map([...this.keys].filter(t => t[0] !== command)));
  }

  public toJson(): JsonObject {
    return Object.fromEntries([...this.keys].map(([command, key]) => [command, key?.text ?? null]));
  }

  private static findSkipReason(name: QualifiedName | null, key: JsonValue | undefined, chord: KeyChord | null): string | null {
    if (Object.isNull(name))
      return Resources.keyBindingUnknownCommand;
    if (Object.isNull(key))
      return null;
    if (!Object.isString(key))
      return Resources.keyBindingNotText;
    if (Object.isNull(chord))
      return Resources.keyBindingNotChord;
    return chord.canBind(name) ? null : Resources.keyBindingNotBindable;
  }
}
