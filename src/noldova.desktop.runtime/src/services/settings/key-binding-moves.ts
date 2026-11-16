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
  public static move(settings: Pick<SettingsService, "define" | "read" | "write">, declarations: readonly ModuleDeclaration[]): void {
    const renames = new Map(declarations.flatMap(t => t.listContributions(Resources.commandsKind).flatMap(u => (t.formerNames.get(u) ?? []).map(v => [v, u] as const))));
    const key = new SettingKey(ShellSettings.keyBindings);
    const type = settings.define(key.name).type;
    const entries = Object.entries(JsonReader.fromValue(settings.read(key)).toJson());
    const bindings = new Map(entries.filter(([name]) => !renames.has(name)));
    let isMoved = false;
    for (const [name, binding] of entries.filter(([former]) => renames.has(former))) {
      const command = String(renames.get(name));
      if (!bindings.has(command))
        bindings.set(type.accepts({ [command]: binding }) ? command : name, binding);
      isMoved ||= bindings.has(command);
    }
    if (isMoved)
      settings.write(new SettingValue(key, Object.fromEntries(bindings)));
  }
}
