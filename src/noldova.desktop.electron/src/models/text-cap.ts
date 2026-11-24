/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

export class TextCap {
  private readonly cap: number;
  private spare: number;

  public constructor(cap: number, spare: number) {
    this.cap = cap;
    this.spare = spare;
  }

  private static isList(value: JsonObject | readonly JsonValue[]): value is readonly JsonValue[] {
    return Array.isArray(value);
  }

  private static cut(text: string, length: number): string {
    const code = text.charCodeAt(length - 1);
    return text.slice(0, code >= 0xd800 && code <= 0xdbff ? length - 1 : length);
  }

  public apply(holder: JsonObject): JsonObject {
    const capped: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(holder))
      capped[key] = this.applyValue(item);
    return capped;
  }

  private applyValue(value: JsonValue): JsonValue {
    if (Object.isString(value))
      return value.length > this.cap ? TextCap.cut(value, this.spare-- > 0 ? this.cap + 1 : this.cap) : value;
    if (!Object.isObject(value))
      return value;
    return TextCap.isList(value) ? value.map(item => this.applyValue(item)) : this.apply(value);
  }
}
