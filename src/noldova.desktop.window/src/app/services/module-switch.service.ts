/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, Injector, inject } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { SettingDefinition } from "@noldova/desktop.protocol";

import { ModuleSwitchTokens } from "../models/module-switch-tokens.js";
import { Resources } from "../../resources.js";
import { ModuleStatusService } from "./module-status.service.js";
import { SettingsService } from "./settings.service.js";

@Injectable({ providedIn: "root" })
export class ModuleSwitchService {
  private readonly statuses: ModuleStatusService = inject(ModuleStatusService);
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly injector: Injector = inject(Injector);
  private readonly changes: Map<string, Promise<void>> = new Map<string, Promise<void>>();

  public setAsync(name: string, value: JsonValue): Promise<void> {
    return this.queueAsync(name, async () => {
      if (await this.maySetAsync(name, value))
        await this.settings.setAsync(name, value);
    });
  }

  public resetAsync(definition: SettingDefinition): Promise<void> {
    const name = definition.name.text;
    return this.queueAsync(name, async () => {
      if (await this.maySetAsync(name, definition.defaultValue))
        await this.settings.resetAsync(name);
    });
  }

  private queueAsync(name: string, change: () => Promise<void>): Promise<void> {
    const queued = (this.changes.get(name) ?? Promise.resolve()).then(change, change);
    this.changes.set(name, queued);
    return queued;
  }

  private async maySetAsync(name: string, value: JsonValue): Promise<boolean> {
    const modules = this.statuses.modules();
    const module = modules.find(t => t.switchSetting === name);
    if (value !== false || Object.isUndefined(module))
      return true;
    const reached = new Set([module.id]);
    for (const other of modules)
      if (other.dependencies.some(t => reached.has(t)))
        reached.add(other.id);
    return await this.injector.get(ModuleSwitchTokens.saver).saveModulesAsync(reached, t => Resources.formatPartSaveFailedStayedOn(t));
  }
}
