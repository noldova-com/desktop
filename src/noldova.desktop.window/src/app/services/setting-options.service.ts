/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ErrorHandler, Injectable, type WritableSignal, inject, signal } from "@angular/core";

import type { JsonObject } from "@noldova/context.json";
import type { SettingOption } from "@noldova/desktop.protocol";

import { SettingOptionsSupply } from "../models/settings/setting-options-supply.js";
import { SettingsService } from "./settings.service.js";

@Injectable({ providedIn: "root" })
export class SettingOptionsService {
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly supplies: WritableSignal<ReadonlyMap<string, SettingOptionsSupply>> = signal(new Map());

  public isDynamic(setting: string): boolean {
    return this.settings.definitions().some(t => t.name.text === setting && t.type.isDynamic);
  }

  public provide(setting: string, provider: (values: JsonObject) => readonly SettingOption[] | null): () => void {
    const supply = new SettingOptionsSupply(setting, provider, this.settings.values, error => this.errors.handleError(error));
    this.supplies.update(t => new Map([...t, [setting, supply]]));
    return () => this.supplies.update(t => t.get(setting) === supply ? new Map([...t].filter(u => u[0] !== setting)) : t);
  }

  public refresh(setting: string): void {
    this.supplies().get(setting)?.refresh();
  }

  public read(setting: string): readonly SettingOption[] | null {
    return this.supplies().get(setting)?.options() ?? null;
  }
}
