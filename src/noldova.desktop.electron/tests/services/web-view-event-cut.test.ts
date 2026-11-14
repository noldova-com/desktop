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

    const event = WebViewEventCut.fit("browser", "1", WebViewEventCutTests.METHOD, params, WebViewEventCutTests.measure(params) - 4);

    Assert.areEqual(JSON.stringify({ method: "Page.frameNavigated", params: { frame: { url: "https://example.com", name: "main", items: ["a", "aaaaaaaaaaaaaaaaaaaaa"] }, id: "first" }, isCut: true }),
      JSON.stringify(event?.details));
    Assert.areEqual("aaaaaaaaaaaaaaaaaaaaaaaaa", params.frame.items[1]);
  }

  @TestMethod
  public cutsTheNextLongestTextWhenTheFirstIsNotEnoughAndTakesTheFirstOfEqualTexts(): void {
    const params = { first: "xxxxxx", second: "yyyyy", third: "zzzzz" };

    const event = WebViewEventCut.fit("browser", "1", WebViewEventCutTests.METHOD, params, WebViewEventCutTests.measure(params) - 8);

    Assert.areEqual(JSON.stringify({ first: "", second: "yyyy", third: "zzzzz" }), JSON.stringify(event?.details["params"]));
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
