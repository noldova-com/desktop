/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject, JsonValue } from "@noldova/context.json";
import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";

import { Resources } from "../resources.js";

export class WebViewEventCut {
  public static fit(module: string, view: string, method: string, params: JsonObject, limit: number): WebViewEvent | null {
    if (WebViewEventCut.measure(module, view, method, params, false) <= limit)
      return WebViewEventCut.create(module, view, method, params, false);
    const excess = Math.max(1, WebViewEventCut.measure(module, view, method, params, true) - limit);
    const lengths: number[] = [];
    WebViewEventCut.collect(params, lengths);
    const cap = WebViewEventCut.findCap(lengths, excess);
    if (Object.isNull(cap))
      return null;
    const spare = { count: lengths.reduce((total, length) => total + Math.max(0, length - cap), 0) - excess };
    return WebViewEventCut.create(module, view, method, WebViewEventCut.capObject(params, cap, spare), true);
  }

  private static create(module: string, view: string, method: string, params: JsonObject, isCut: boolean): WebViewEvent {
    return new WebViewEvent(module, view, WebViewEventKind.Protocol, { [Resources.methodField]: method, [Resources.paramsField]: params, [Resources.isCutField]: isCut });
  }

  private static measure(module: string, view: string, method: string, params: JsonObject, isCut: boolean): number {
    return Buffer.byteLength(JSON.stringify(WebViewEventCut.create(module, view, method, params, isCut).toJson()));
  }

  private static collect(value: JsonValue, lengths: number[]): void {
    if (Object.isString(value))
      lengths.push(value.length);
    else if (Object.isObject(value))
      for (const item of Object.values(value))
        WebViewEventCut.collect(item, lengths);
  }

  private static findCap(lengths: readonly number[], excess: number): number | null {
    const sorted = [...lengths].sort((first, second) => second - first);
    let total = 0;
    for (const [index, length] of sorted.entries()) {
      total += length;
      const cap = Math.floor((total - excess) / (index + 1));
      if (cap >= (sorted[index + 1] ?? 0))
        return cap;
    }
    return null;
  }

  private static capObject(holder: JsonObject, cap: number, spare: { count: number }): JsonObject {
    return Object.fromEntries(Object.entries(holder).map(([key, item]): [string, JsonValue] => [key, WebViewEventCut.capValue(item, cap, spare)]));
  }

  private static capValue(value: JsonValue, cap: number, spare: { count: number }): JsonValue {
    if (Object.isString(value))
      return value.length > cap ? WebViewEventCut.cut(value, spare.count-- > 0 ? cap + 1 : cap) : value;
    if (!Object.isObject(value))
      return value;
    return WebViewEventCut.isList(value) ? value.map(item => WebViewEventCut.capValue(item, cap, spare)) : WebViewEventCut.capObject(value, cap, spare);
  }

  private static isList(value: JsonObject | readonly JsonValue[]): value is readonly JsonValue[] {
    return Array.isArray(value);
  }

  private static cut(text: string, length: number): string {
    const code = text.charCodeAt(length - 1);
    return text.slice(0, code >= 0xd800 && code <= 0xdbff ? length - 1 : length);
  }
}
