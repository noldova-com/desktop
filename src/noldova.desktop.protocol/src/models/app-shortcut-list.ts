/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { AppShortcut } from "./app-shortcut.js";

export class AppShortcutList {
  private static readonly FIELDS: readonly string[] = [Resources.shortcutsField];

  public readonly shortcuts: readonly AppShortcut[];

  public constructor(shortcuts: readonly AppShortcut[]) {
    this.shortcuts = [...shortcuts];
  }

  public static fromJson(value: unknown, path?: string): AppShortcutList {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, AppShortcutList.FIELDS);
    return WireContract.create(reader, () => new AppShortcutList(
      reader.readObjectArray(Resources.shortcutsField).map(t => AppShortcut.fromJson(t.toJson(), t.path))));
  }

  public toJson(): JsonObject {
    return { [Resources.shortcutsField]: this.shortcuts.map(t => t.toJson()) };
  }
}
