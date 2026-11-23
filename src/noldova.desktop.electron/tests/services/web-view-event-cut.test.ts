/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";

import { WebViewEventCut } from "../../src/services/web-view-event-cut.js";

@TestClass
export class WebViewEventCutTests {
  private static readonly METHOD: string = "Page.frameNavigated";

  @TestMethod
  public keepsAnEventThatFitsWhole(): void {
    const params = { frame: { url: "https://example.com" } };

    const event = WebViewEventCut.fit("browser", "1", WebViewEventCutTests.METHOD, params, WebViewEventCutTests.measure(params));

    Assert.areEqual(JSON.stringify({ module: "browser", view: "1", kind: "Protocol", details: { method: "Page.frameNavigated", params, isCut: false } }),
      JSON.stringify(event?.toJson()));
  }

  @TestMethod
  public cutsTheLongestTextByWhatTheEventIsOverItsLimit(): void {
    const params = { frame: { url: "https://example.com", name: "main", items: ["a", "aaaaaaaaaaaaaaaaaaaaaaaaa"] }, id: "first" };
    const limit = WebViewEventCutTests.measure(params) - 4;

    const event = WebViewEventCut.fit("browser", "1", WebViewEventCutTests.METHOD, params, limit);

    Assert.areEqual(JSON.stringify({ method: "Page.frameNavigated", params: { frame: { url: "https://example.com", name: "main", items: ["a", "aaaaaaaaaaaaaaaaaaaaaa"] }, id: "first" }, isCut: true }),
      JSON.stringify(event?.details));
    Assert.areEqual(limit, Buffer.byteLength(JSON.stringify(event?.toJson())));
    Assert.areEqual("aaaaaaaaaaaaaaaaaaaaaaaaa", params.frame.items[1]);
  }

  @TestMethod
  public capsTheLongestTextsAtOneLengthAndLeavesACharacterMoreOnTheFirstOfThemToCutOnlyTheExcess(): void {
    const params = { first: "xxxxxx", list: ["yyyyy", 7], third: "zzzzz", isOpen: true };
    const limit = WebViewEventCutTests.measure(params) - 9;

    const event = WebViewEventCut.fit("browser", "1", WebViewEventCutTests.METHOD, params, limit);

    Assert.areEqual(JSON.stringify({ first: "xxx", list: ["yyy", 7], third: "zz", isOpen: true }), JSON.stringify(event?.details["params"]));
    Assert.areEqual(limit, Buffer.byteLength(JSON.stringify(event?.toJson())));
  }

  @TestMethod
  public keepsACutFromSplittingACharactersSurrogatePair(): void {
    const params = { text: "a\u{1F600}\u{1F600}" };

    const event = WebViewEventCut.fit("browser", "1", WebViewEventCutTests.METHOD, params, WebViewEventCutTests.measure(params) - 4);

    Assert.areEqual(JSON.stringify({ text: "a" }), JSON.stringify(event?.details["params"]));
  }

  @TestMethod
  public measuresAnEventOfManyTextsTwiceWhateverTheirNumber(): void {
    const params = { items: Array.from({ length: 100_000 }, () => "x") };
    const limit = WebViewEventCutTests.measure(params) - 50_001;
    const stringify = JSON.stringify;
    let calls = 0;
    Object.defineProperty(JSON, "stringify", {
      configurable: true,
      writable: true,
      value(...values: unknown[]): unknown {
        calls++;
        return Reflect.apply(stringify, JSON, values);
      }
    });
    let event: WebViewEvent | null;
    try {
      event = WebViewEventCut.fit("browser", "1", WebViewEventCutTests.METHOD, params, limit);
    } finally {
      JSON.stringify = stringify;
    }

    Assert.areEqual(2, calls);
    Assert.areEqual(limit, Buffer.byteLength(JSON.stringify(event?.toJson())));
    Assert.areEqual(JSON.stringify({ items: [...Array.from({ length: 50_000 }, () => "x"), ...Array.from({ length: 50_000 }, () => "")] }), JSON.stringify(event?.details["params"]));
  }

  @TestMethod
  public dropsAnEventWithNoTextLeftToCut(): void {
    const params = { values: [1, 2, 3], isOpen: true, none: null, empty: "" };

    const event = WebViewEventCut.fit("browser", "1", WebViewEventCutTests.METHOD, params, WebViewEventCutTests.measure(params) - 1);

    Assert.isNull(event);
  }

  private static measure(params: JsonObject): number {
    return Buffer.byteLength(JSON.stringify(new WebViewEvent("browser", "1", WebViewEventKind.Protocol, { method: WebViewEventCutTests.METHOD, params, isCut: false }).toJson()));
  }
}
