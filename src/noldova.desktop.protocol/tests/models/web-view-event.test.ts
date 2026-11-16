/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";

@TestClass
export class WebViewEventTests {
  private static readonly VALID: ReadonlyMap<WebViewEventKind, JsonObject> = new Map<WebViewEventKind, JsonObject>([
    [WebViewEventKind.Opened, { pane: { name: "browser.pane" }, profileKey: "workspace-1" }],
    [WebViewEventKind.Closed, {}],
    [WebViewEventKind.State, { address: "https://example.com/", title: "Example", isLoading: false, canGoBack: true, canGoForward: false }],
    [WebViewEventKind.LoadFailed, { address: "https://example.com/", code: -105, description: "ERR_NAME_NOT_RESOLVED" }],
    [WebViewEventKind.NavigationRefused, { address: "https://example.net/", origin: "https://example.net", isRedirect: true }],
    [WebViewEventKind.Crashed, {}],
    [WebViewEventKind.ProfileCleared, { profileKey: "workspace-1" }],
    [WebViewEventKind.RequestRefused, { request: "download", origin: "https://example.com" }],
    [WebViewEventKind.NewWindowRequested, { address: "https://example.com/next", hadRecentInput: true, origin: "https://example.com" }],
    [WebViewEventKind.Protocol, { method: "Page.loadEventFired", params: { timestamp: 1 }, isCut: false }],
    [WebViewEventKind.Dropped, { count: 3 }],
    [WebViewEventKind.Key, { name: "reload" }],
    [WebViewEventKind.Zoom, { factor: 1.25 }],
    [WebViewEventKind.Found, { matches: 4, active: 2 }],
    [WebViewEventKind.Favicon, { image: "data:image/png;base64,iVBORw0KGgo=" }]
  ]);

  @TestMethod
  public pinsTheWireFormOfEveryKind(): void {
    for (const [kind, details] of WebViewEventTests.VALID) {
      const event = new WebViewEvent("browser", "7", kind, details);
      const text = JSON.stringify({ module: "browser", view: "7", kind, ...Object.keys(details).length === 0 ? {} : { details } });

      Assert.areEqual(text, JSON.stringify(event.toJson()));
      Assert.areEqual(text, JSON.stringify(WebViewEvent.fromJson(JsonReader.parse(text).toJson()).toJson()));
    }
  }

  @TestMethod
  public carriesANewWindowRequestWhoseOriginIsUnknown(): void {
    const text = "{\"module\":\"browser\",\"view\":\"7\",\"kind\":\"NewWindowRequested\",\"details\":{\"address\":\"https://example.com/next\",\"hadRecentInput\":false,\"origin\":null}}";

    Assert.areEqual(text, JSON.stringify(WebViewEvent.fromJson(JsonReader.parse(text).toJson()).toJson()));
  }

  @TestMethod
  public carriesAPageWithoutAnIconAndTheLargestIcon(): void {
    const largest = `data:image/png;base64,${"A".repeat(21_848)}`;

    Assert.isNull(new WebViewEvent("browser", "7", WebViewEventKind.Favicon, { image: null }).details["image"]);
    Assert.areEqual(largest, new WebViewEvent("browser", "7", WebViewEventKind.Favicon, { image: largest }).details["image"]);
  }

  @TestMethod
  public refusesDetailsThatDontFitTheKind(): void {
    const refused: readonly [WebViewEventKind, JsonObject][] = [
      [WebViewEventKind.Closed, { address: "x" }],
      [WebViewEventKind.State, { address: "x", title: "t", isLoading: false, canGoBack: true }],
      [WebViewEventKind.State, { address: "x", title: "t", isLoading: "no", canGoBack: true, canGoForward: false }],
      [WebViewEventKind.LoadFailed, { address: "x", code: 1.5, description: "d" }],
      [WebViewEventKind.Opened, { pane: { name: "pane" }, profileKey: "a" }],
      [WebViewEventKind.Opened, { pane: { name: "browser.pane" }, profileKey: "A" }],
      [WebViewEventKind.RequestRefused, { request: "camera", origin: "https://example.com" }],
      [WebViewEventKind.NewWindowRequested, { address: "https://example.com/next", hadRecentInput: "yes", origin: null }],
      [WebViewEventKind.NewWindowRequested, { address: "https://example.com/next", hadRecentInput: false, origin: 1 }],
      [WebViewEventKind.NewWindowRequested, { address: "https://example.com/next", hadRecentInput: false }],
      [WebViewEventKind.Protocol, { method: "Page.loadEventFired", params: [], isCut: false }],
      [WebViewEventKind.Dropped, { count: 0 }],
      [WebViewEventKind.Zoom, { factor: 0.2 }],
      [WebViewEventKind.Zoom, { factor: 5.5 }],
      [WebViewEventKind.Zoom, { factor: "1" }],
      [WebViewEventKind.Found, { matches: 2, active: 3 }],
      [WebViewEventKind.Found, { matches: -1, active: 0 }],
      [WebViewEventKind.Found, { matches: 1.5, active: 0 }],
      [WebViewEventKind.Favicon, {}],
      [WebViewEventKind.Favicon, { image: "data:image/jpeg;base64,/9j/" }],
      [WebViewEventKind.Favicon, { image: "https://example.com/favicon.ico" }],
      [WebViewEventKind.Favicon, { image: "data:image/png;base64,iVBORw0KGgo" }],
      [WebViewEventKind.Favicon, { image: `data:image/png;base64,${"A".repeat(21_852)}` }],
      [WebViewEventKind.Favicon, { image: 1 }]
    ];

    for (const [kind, details] of refused)
      Assert.areEqual("details", Assert.throws(() => new WebViewEvent("browser", "7", kind, details), ArgumentException).parameterName);
    Assert.areEqual("module", Assert.throws(() => new WebViewEvent("desktop", "7", WebViewEventKind.Closed), ArgumentException).parameterName);
    Assert.areEqual("view", Assert.throws(() => new WebViewEvent("browser", String.empty, WebViewEventKind.Closed), ArgumentException).parameterName);
  }

  @TestMethod
  public namesTheInvalidField(): void {
    Assert.areEqual("$.kind", Assert.throws(() => WebViewEvent.fromJson({ module: "browser", view: "7", kind: "shown" }), JsonException).path);
    Assert.areEqual("$.details", Assert.throws(() => WebViewEvent.fromJson({ module: "browser", view: "7", kind: "Crashed", details: { at: 1 } }), JsonException).path);
    Assert.areEqual("$.extra", Assert.throws(() => WebViewEvent.fromJson({ module: "browser", view: "7", kind: "Crashed", extra: 1 }), JsonException).path);
  }
}
