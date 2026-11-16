/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { SettingKey, SettingValue } from "@noldova/desktop.protocol";
import type { ModuleDeclaration } from "../../models/module-declaration.js";
import { Resources } from "../../resources.js";
import type { SettingsService } from "./settings.service.js";
import { ShellSettings } from "./shell-settings.js";

export class KeyBindingMoves {
  public static move(settings: Pick<SettingsService, "read" | "write">, declarations: readonly ModuleDeclaration[]): void {
    const renames = new Map(declarations.flatMap(t => t.listContributions(Resources.commandsKind).flatMap(u => (t.formerNames.get(u) ?? []).map(v => [v, u] as const))));
    const key = new SettingKey(ShellSettings.keyBindings);
    const entries = Object.entries(JsonReader.fromValue(settings.read(key)).toJson());
    const moving = entries.filter(([name]) => renames.has(name));
    if (moving.length === 0)
      return;
    const kept = entries.filter(([name]) => !renames.has(name));
    const names = new Set(kept.map(([name]) => name));
    const moved = moving.flatMap(([name, binding]) => {
      const command = String(renames.get(name));
      if (names.has(command))
        return [];
      names.add(command);
      return [[command, binding] as const];
    });
    settings.write(new SettingValue(key, Object.fromEntries([...kept, ...moved])));
  }
}
