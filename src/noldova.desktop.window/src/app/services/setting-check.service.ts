/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type WritableSignal, inject, signal } from "@angular/core";

import { SettingsService } from "./settings.service.js";

@Injectable({ providedIn: "root" })
export class SettingCheckService {
  private readonly settings: SettingsService = inject(SettingsService);
  private readonly checks: WritableSignal<ReadonlyMap<string, (value: string) => string | null>> = signal(new Map());

  public isChecked(setting: string): boolean {
    return this.settings.definitions().some(t => t.name.text === setting && t.type.isChecked);
  }

  public provide(setting: string, check: (value: string) => string | null): () => void {
    this.checks.update(t => new Map([...t, [setting, check]]));
    return () => this.checks.update(t => t.get(setting) === check ? new Map([...t].filter(u => u[0] !== setting)) : t);
  }

  public read(setting: string): ((value: string) => string | null) | null {
    return this.checks().get(setting) ?? null;
  }
}
