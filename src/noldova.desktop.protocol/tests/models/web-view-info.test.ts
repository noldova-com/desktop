/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { QualifiedName, WebViewInfo, WebViewPane } from "@noldova/desktop.protocol";

@TestClass
export class WebViewInfoTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"id\":\"7\",\"module\":\"browser\",\"pane\":{\"name\":\"browser.pane\"},\"profileKey\":\"workspace-1\"}";

    Assert.areEqual(text, JSON.stringify(WebViewInfo.fromJson(JsonReader.parse(text).toJson()).toJson()));
  }

  @TestMethod
  public refusesAViewOfAnotherModulesPaneOrAnInvalidKey(): void {
    const pane = new WebViewPane(QualifiedName.parse("browser.pane"));

    Assert.areEqual("module", Assert.throws(() => new WebViewInfo("7", "notes", pane, "a"), ArgumentException).parameterName);
    Assert.areEqual("module", Assert.throws(() => new WebViewInfo("7", "desktop", new WebViewPane(QualifiedName.parse("desktop.pane")), "a"), ArgumentException).parameterName);
    Assert.areEqual("id", Assert.throws(() => new WebViewInfo(" ", "browser", pane, "a"), ArgumentException).parameterName);
    for (const key of [String.empty, "-a", "A", "a_b", "a".repeat(65)])
      Assert.areEqual("profileKey", Assert.throws(() => new WebViewInfo("7", "browser", pane, key), ArgumentException).parameterName);
    Assert.areEqual("a".repeat(64), new WebViewInfo("7", "browser", pane, "a".repeat(64)).profileKey);
  }

  @TestMethod
  public namesTheInvalidField(): void {
    Assert.areEqual("$.pane.name", Assert.throws(() => WebViewInfo.fromJson({ id: "7", module: "browser", pane: { name: "pane" }, profileKey: "a" }), JsonException).path);
    Assert.areEqual("$.profileKey", Assert.throws(() => WebViewInfo.fromJson({ id: "7", module: "browser", pane: { name: "browser.pane" }, profileKey: "A" }), JsonException).path);
  }
}
