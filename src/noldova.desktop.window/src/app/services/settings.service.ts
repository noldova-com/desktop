/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DestroyRef, Injectable, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import {
  KeyText,
  QualifiedName,
  SettingChange,
  SettingDefinition,
  SettingEntry,
  SettingKey,
  SettingOption,
  SettingType,
  SettingValue,
  SettingsQuery,
  SettingsSnapshot,
  ShellEvents,
  ShellMethods,
  type SettingScope
} from "@noldova/desktop.protocol";

import { UnconfirmedAction } from "../enums/unconfirmed-action.js";
import { ActionNotConfirmedException } from "../exceptions/action-not-confirmed.exception.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";

@Injectable({ providedIn: "root" })
export class SettingsService {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly definitionList: WritableSignal<readonly SettingDefinition[]> = signal([]);
  private readonly valueMap: WritableSignal<ReadonlyMap<string, JsonValue>> = signal(new Map());
  private readonly setNames: WritableSignal<ReadonlySet<string>> = signal(new Set());
  private readonly listeners: Set<(change: SettingChange) => void> = new Set();
  private loads: number = 0;
  private loading: number = 0;
  private received: SettingChange[] = [];

  public readonly definitions: Signal<readonly SettingDefinition[]> = this.definitionList.asReadonly();
  public readonly values: Signal<ReadonlyMap<string, JsonValue>> = this.valueMap.asReadonly();

  public constructor() {
    inject(DestroyRef).onDestroy(this.bridge.onEvent((name, payload) => {
      if (name === ShellEvents.settingsChanged.text)
        this.apply(SettingChange.fromJson(payload));
    }));
  }

  public async loadAsync(): Promise<void> {
    const load = ++this.loads;
    this.loading++;
    try {
      const snapshot = SettingsSnapshot.fromJson(await this.bridge.requestAsync(ShellMethods.settings.text, new SettingsQuery(null).toJson()));
      if (load === this.loads) {
        this.definitionList.set(snapshot.definitions.map(t => this.forPlatform(t)));
        this.valueMap.set(new Map(snapshot.entries.map(t => [t.name.text, t.value])));
        this.setNames.set(new Set(snapshot.entries.filter(t => t.isSet).map(t => t.name.text)));
        for (const change of this.received)
          this.store(change);
      }
    }
    finally {
      if (--this.loading === 0)
        this.received = [];
    }
  }

  public value(name: string): Signal<JsonValue | undefined> {
    return computed(() => this.valueMap().get(name));
  }

  public isSet(name: string): Signal<boolean> {
    return computed(() => this.setNames().has(name));
  }

  public read(name: string): JsonValue | undefined {
    return this.valueMap().get(name);
  }

  public async readAsync(name: string, scope: SettingScope | null): Promise<SettingEntry> {
    return SettingEntry.fromJson(await this.bridge.requestAsync(ShellMethods.readSetting.text, new SettingKey(QualifiedName.parse(name), scope).toJson()));
  }

  public async setAsync(name: string, value: JsonValue, scope: SettingScope | null = null): Promise<void> {
    await this.changeAsync(name, ShellMethods.setSetting.text, new SettingValue(new SettingKey(QualifiedName.parse(name), scope), value).toJson());
  }

  public async resetAsync(name: string, scope: SettingScope | null = null): Promise<void> {
    await this.changeAsync(name, ShellMethods.resetSetting.text, new SettingKey(QualifiedName.parse(name), scope).toJson());
  }

  public onChanged(listener: (change: SettingChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async changeAsync(name: string, method: string, payload: JsonValue): Promise<void> {
    try {
      await this.bridge.requestAsync(method, payload);
    }
    catch (error) {
      throw ActionNotConfirmedException.from(error, UnconfirmedAction.Setting, name);
    }
  }

  private apply(change: SettingChange): void {
    if (this.loading > 0)
      this.received.push(change);
    this.store(change);
    for (const listener of [...this.listeners])
      listener(change);
  }

  private store(change: SettingChange): void {
    if (!Object.isNull(change.key.scope))
      return;
    const name = change.key.name.text;
    this.valueMap.update(t => new Map([...t, [name, change.value]]));
    this.setNames.update(t => new Set(change.isSet ? [...t, name] : [...t].filter(u => u !== name)));
  }

  private forPlatform(definition: SettingDefinition): SettingDefinition {
    const platform = this.bridge.platform;
    const options = definition.type.options;
    const type = options.length === 0 ? definition.type : SettingType.choice(options.map(t => new SettingOption(t.value, KeyText.format(t.title, platform))));
    return new SettingDefinition(definition.name, KeyText.format(definition.title, platform), KeyText.format(definition.description, platform), type, definition.defaultValue,
      definition.locality, definition.scopes, definition.page, definition.group);
  }
}
