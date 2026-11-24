/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class TextCap {
  private readonly cap: number;
  private slack: number;

  public constructor(cap: number, slack: number) {
    this.cap = cap;
    this.slack = slack;
  }

  public static sizeOf(text: string): number {
    let size = 0;
    for (const character of text)
      size += TextCap.sizeOfCharacter(character);
    return size;
  }

  private static sizeOfCharacter(character: string): number {
    if (character.length > 1)
      return Resources.utf8PairSize;
    const code = character.charCodeAt(0);
    if (Resources.jsonShortEscapes.includes(code))
      return Resources.jsonShortEscapeSize;
    if (code < Resources.jsonControlLimit || (code >= Resources.surrogateFirst && code <= Resources.surrogateLast))
      return Resources.jsonUnicodeEscapeSize;
    const index = Resources.utf8SizeLimits.findIndex(t => code < t);
    return (index < 0 ? Resources.utf8SizeLimits.length : index) + 1;
  }

  private static isList(value: JsonObject | readonly JsonValue[]): value is readonly JsonValue[] {
    return Array.isArray(value);
  }

  public apply(holder: JsonObject): JsonObject {
    const capped: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(holder))
      capped[key] = this.applyValue(item);
    return capped;
  }

  private applyValue(value: JsonValue): JsonValue {
    if (Object.isString(value))
      return this.applyText(value);
    if (!Object.isObject(value))
      return value;
    return TextCap.isList(value) ? value.map(item => this.applyValue(item)) : this.apply(value);
  }

  private applyText(text: string): string {
    let kept = 0;
    let end = 0;
    for (const character of text) {
      const size = TextCap.sizeOfCharacter(character);
      if (kept + size > this.cap) {
        this.slack += this.cap - kept;
        if (size > this.slack)
          return text.slice(0, end);
        this.slack -= size;
        return text.slice(0, end + character.length);
      }
      kept += size;
      end += character.length;
    }
    return text;
  }
}
