/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";

export class LongestText {
  public readonly path: readonly string[];
  public readonly text: string;

  public constructor(path: readonly string[], text: string) {
    this.path = path;
    this.text = text;
  }

  public shorten(params: JsonObject, excess: number): JsonObject {
    return this.replaceIn(params, 0, this.text.slice(0, Math.max(0, this.text.length - excess)));
  }

  private replaceIn(holder: JsonObject, depth: number, text: string): JsonObject {
    return Object.fromEntries(Object.entries(holder).map(([key, item]): [string, JsonValue] => [key, this.replaceAt(key, item, depth, text)]));
  }

  private replaceAt(key: string, item: JsonValue, depth: number, text: string): JsonValue {
    if (this.path.at(depth) !== key)
      return item;
    if (depth === this.path.length - 1)
      return text;
    if (!Object.isObject(item))
      return item;
    return LongestText.isList(item) ? item.map((t, index) => this.replaceAt(String(index), t, depth + 1, text)) : this.replaceIn(item, depth + 1, text);
  }

  private static isList(value: JsonObject | readonly JsonValue[]): value is readonly JsonValue[] {
    return Array.isArray(value);
  }
}
