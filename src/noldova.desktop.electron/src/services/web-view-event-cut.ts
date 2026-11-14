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

import { LongestText } from "../models/longest-text.js";
import { Resources } from "../resources.js";

export class WebViewEventCut {
  public static fit(module: string, view: string, method: string, params: JsonObject, limit: number): WebViewEvent | null {
    let fitted = params;
    let isCut = false;
    for (let size = WebViewEventCut.measure(module, view, method, fitted, isCut); size > limit; size = WebViewEventCut.measure(module, view, method, fitted, isCut)) {
      const longest = WebViewEventCut.findLongest(fitted, []);
      if (Object.isNull(longest))
        return null;
      fitted = longest.shorten(fitted, size - limit);
      isCut = true;
    }
    return new WebViewEvent(module, view, WebViewEventKind.Protocol, { [Resources.methodField]: method, [Resources.paramsField]: fitted, [Resources.isCutField]: isCut });
  }

  private static measure(module: string, view: string, method: string, params: JsonObject, isCut: boolean): number {
    const event = new WebViewEvent(module, view, WebViewEventKind.Protocol, { [Resources.methodField]: method, [Resources.paramsField]: params, [Resources.isCutField]: isCut });
    return Buffer.byteLength(JSON.stringify(event.toJson()));
  }

  private static findLongest(holder: JsonObject | readonly JsonValue[], path: readonly string[]): LongestText | null {
    let longest: LongestText | null = null;
    const entries: [string, JsonValue][] = Object.entries(holder);
    for (const [key, item] of entries) {
      const found = Object.isString(item)
        ? (item.length > 0 ? new LongestText([...path, key], item) : null)
        : (Object.isObject(item) ? WebViewEventCut.findLongest(item, [...path, key]) : null);
      if (!Object.isNull(found) && (Object.isNull(longest) || found.text.length > longest.text.length))
        longest = found;
    }
    return longest;
  }
}
