/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewEvents } from "@noldova/desktop.protocol";

@TestClass
export class WebViewEventsTests {
  @TestMethod
  public pinsItsWireFormInOrder(): void {
    const text = "{\"events\":[{\"module\":\"browser\",\"view\":\"7\",\"kind\":\"Crashed\"},{\"module\":\"notes\",\"view\":\"8\",\"kind\":\"Closed\"}]}";

    Assert.areEqual(text, JSON.stringify(WebViewEvents.fromJson(JsonReader.parse(text).toJson()).toJson()));
  }

  @TestMethod
  public refusesAnEmptyBatchAndNamesTheInvalidEvent(): void {
    Assert.throws(() => new WebViewEvents([]), ArgumentException);
    Assert.areEqual("$.events.1.kind", Assert.throws(() => WebViewEvents.fromJson({ events: [{ module: "browser", view: "7", kind: "Crashed" }, { module: "browser", view: "7", kind: "x" }] }), JsonException).path);
  }
}
