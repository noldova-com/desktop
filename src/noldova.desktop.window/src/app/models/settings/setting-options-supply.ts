/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Signal, type WritableSignal, computed, signal, untracked } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { QualifiedName, type SettingOption } from "@noldova/desktop.protocol";

import { SettingOptionsFailedException } from "../../exceptions/setting-options-failed.exception.js";
import { SettingOptionsRepeatedException } from "../../exceptions/setting-options-repeated.exception.js";
import { Resources } from "../../../resources.js";

export class SettingOptionsSupply {
  private readonly refreshes: WritableSignal<number> = signal(0);

  public readonly options: Signal<readonly SettingOption[] | null>;

  public constructor(setting: string, provider: (values: JsonObject) => readonly SettingOption[] | null, values: Signal<ReadonlyMap<string, JsonValue>>, report: (error: unknown) => void) {
    const moduleId = QualifiedName.parse(setting).owner;
    const prefix = `${moduleId}${Resources.contributionSeparator}`;
    const moduleValues = computed(() => Object.fromEntries([...values()].filter(([name]) => name.startsWith(prefix))), { equal: SettingOptionsSupply.haveSameEntries });
    this.options = computed(() => {
      this.refreshes();
      const current = moduleValues();
      try {
        const options = untracked(() => provider(current));
        if (Object.isNull(options) || new Set(options.map(t => t.value)).size === options.length)
          return options;
        report(new SettingOptionsRepeatedException(moduleId, setting));
      }
      catch (error) {
        report(new SettingOptionsFailedException(moduleId, setting, error));
      }
      return null;
    });
  }

  public refresh(): void {
    this.refreshes.update(t => t + 1);
  }

  private static haveSameEntries(first: JsonObject, second: JsonObject): boolean {
    const names = Object.keys(first);
    return names.length === Object.keys(second).length && names.every(t => Object.hasOwn(second, t) && JSON.stringify(first[t]) === JSON.stringify(second[t]));
  }
}
