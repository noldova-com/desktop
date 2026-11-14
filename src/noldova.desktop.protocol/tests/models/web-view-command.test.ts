/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewAction, WebViewCommand } from "@noldova/desktop.protocol";

@TestClass
export class WebViewCommandTests {
  @TestMethod
  public pinsItsWireFormForEachAction(): void {
    const send = { method: "Page.captureScreenshot", params: { format: "png" }, timeoutMilliseconds: 10000 };
    const commands: readonly [WebViewAction, string | null, JsonValue][] = [
      [WebViewAction.List, null, null],
      [WebViewAction.Navigate, "7", "https://example.com/"],
      [WebViewAction.Back, "7", null],
      [WebViewAction.Forward, "7", null],
      [WebViewAction.Reload, "7", null],
      [WebViewAction.Stop, "7", null],
      [WebViewAction.SetAllowedOrigins, "7", ["https://example.com", "https://*.example.org"]],
      [WebViewAction.ClearProfile, null, "workspace-1"],
      [WebViewAction.Send, "7", send]
    ];

    for (const [action, view, value] of commands) {
      const text = JSON.stringify({ call: 3, module: "browser", action, ...Object.isNull(view) ? {} : { view }, ...Object.isNull(value) ? {} : { value } });

      Assert.areEqual(text, JSON.stringify(new WebViewCommand(3, "browser", action, view, value).toJson()));
      Assert.areEqual(text, JSON.stringify(WebViewCommand.fromJson(JsonReader.parse(text).toJson()).toJson()));
    }
  }

  @TestMethod
  public refusesAValueOrAViewThatDoesntFitTheAction(): void {
    const send = { method: "Page.enable", params: {}, timeoutMilliseconds: 100 };
    const values: readonly [WebViewAction, JsonValue][] = [
      [WebViewAction.Navigate, String.empty],
      [WebViewAction.Navigate, `https://example.com/${"a".repeat(32768)}`],
      [WebViewAction.Back, "x"],
      [WebViewAction.SetAllowedOrigins, "https://example.com"],
      [WebViewAction.SetAllowedOrigins, [" "]],
      [WebViewAction.Send, { ...send, timeoutMilliseconds: 10001 }],
      [WebViewAction.Send, { ...send, timeoutMilliseconds: 0 }],
      [WebViewAction.Send, { ...send, params: [] }],
      [WebViewAction.Send, { ...send, sessionId: "child" }],
      [WebViewAction.Send, { params: {}, timeoutMilliseconds: 100 }],
      [WebViewAction.Send, "Page.enable"]
    ];

    for (const [action, value] of values)
      Assert.areEqual("value", Assert.throws(() => new WebViewCommand(1, "browser", action, "7", value), ArgumentException).parameterName);
    Assert.areEqual("value", Assert.throws(() => new WebViewCommand(1, "browser", WebViewAction.ClearProfile, null, "A"), ArgumentException).parameterName);
    Assert.areEqual("view", Assert.throws(() => new WebViewCommand(1, "browser", WebViewAction.Navigate, null, "https://example.com/"), ArgumentException).parameterName);
    Assert.areEqual("view", Assert.throws(() => new WebViewCommand(1, "browser", WebViewAction.List, "7"), ArgumentException).parameterName);
    Assert.areEqual("call", Assert.throws(() => new WebViewCommand(0, "browser", WebViewAction.List), ArgumentException).parameterName);
    Assert.areEqual("module", Assert.throws(() => new WebViewCommand(1, "desktop", WebViewAction.List), ArgumentException).parameterName);
  }

  @TestMethod
  public namesTheInvalidField(): void {
    Assert.areEqual("$.action", Assert.throws(() => WebViewCommand.fromJson({ call: 1, module: "browser", action: "open" }), JsonException).path);
    Assert.areEqual("$.value", Assert.throws(() => WebViewCommand.fromJson({ call: 1, module: "browser", action: "Navigate", view: "7", value: 1 }), JsonException).path);
  }
}
