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

import { Resources } from "../resources.js";
import type { IKeyStroke } from "../interfaces/i-key-stroke.js";
import { WireContract } from "../services/wire-contract.js";
import { WebViewKey } from "./web-view-key.js";
import { WebViewMethod } from "./web-view-method.js";

export class WebViewDeclaration {
  private static readonly FIELDS: readonly string[] = [Resources.methodsField, Resources.eventsField, Resources.keysField, Resources.newWindowsField];

  public readonly methods: readonly WebViewMethod[];
  public readonly events: readonly string[];
  public readonly keys: readonly WebViewKey[];
  public readonly newWindows: boolean;

  public constructor(methods: readonly WebViewMethod[] = [], events: readonly string[] = [], keys: readonly WebViewKey[] = [], newWindows: boolean = false) {
    if (new Set(methods.map(t => t.name)).size !== methods.length)
      throw new ArgumentException(Resources.webViewNamesRepeated, Resources.methodsField);
    if (events.some(t => !Resources.webViewMethodPattern.test(t)))
      throw new ArgumentException(Resources.webViewMethodNameInvalid, Resources.eventsField);
    if (new Set(events).size !== events.length)
      throw new ArgumentException(Resources.webViewNamesRepeated, Resources.eventsField);
    if (keys.length > Resources.webViewKeysLimit || new Set(keys.map(t => t.name)).size !== keys.length || !WebViewDeclaration.hasDistinctKeys(keys))
      throw new ArgumentException(Resources.webViewKeysRepeated, Resources.keysField);

    this.methods = [...methods];
    this.events = [...events];
    this.keys = [...keys];
    this.newWindows = newWindows;
  }

  public static fromJson(value: unknown, path?: string): WebViewDeclaration {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewDeclaration.FIELDS);
    return WireContract.create(reader, () => new WebViewDeclaration(
      reader.hasField(Resources.methodsField) ? reader.readObjectArray(Resources.methodsField).map(t => WebViewMethod.fromJson(t.toJson(), t.path)) : [],
      reader.hasField(Resources.eventsField) ? reader.readStringArray(Resources.eventsField) : [],
      reader.hasField(Resources.keysField) ? reader.readObjectArray(Resources.keysField).map(t => WebViewKey.fromJson(t.toJson(), t.path)) : [],
      reader.hasField(Resources.newWindowsField) ? reader.readBoolean(Resources.newWindowsField) : false));
  }

  public allows(method: string, parameters: unknown): boolean {
    return this.methods.find(t => t.name === method)?.allows(parameters) ?? false;
  }

  public allowsEvent(method: string): boolean {
    return this.events.includes(method);
  }

  public findKey(stroke: IKeyStroke, platform: string): string | null {
    return this.keys.find(t => t.matches(stroke, platform))?.name ?? null;
  }

  public toJson(): JsonObject {
    return {
      [Resources.methodsField]: this.methods.map(t => t.toJson()),
      [Resources.eventsField]: [...this.events],
      [Resources.keysField]: this.keys.map(t => t.toJson()),
      ...this.newWindows ? { [Resources.newWindowsField]: true } : {}
    };
  }

  private static hasDistinctKeys(keys: readonly WebViewKey[]): boolean {
    return [Resources.standardPlatform, Resources.macPlatform].every(t => {
      const chords = keys.flatMap(u => u.keysOn(t));
      return chords.every((u, index) => chords.findIndex(v => v.isSameOn(u, t)) === index);
    });
  }
}
