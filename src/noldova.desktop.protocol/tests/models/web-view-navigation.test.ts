/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewNavigation, WebViewNavigationKind } from "@noldova/desktop.protocol";

@TestClass
export class WebViewNavigationTests {
  @TestMethod
  public pinsItsWireFormForEveryKind(): void {
    Assert.areEqual("{\"kind\":\"Started\"}|{\"kind\":\"NoHistory\"}|{\"kind\":\"Refused\",\"origin\":\"https://example.net\"}", [
      WebViewNavigation.fromJson({ kind: "Started" }), new WebViewNavigation(WebViewNavigationKind.NoHistory),
      WebViewNavigation.fromJson({ kind: "Refused", origin: "https://example.net" })
    ].map(t => JSON.stringify(t.toJson())).join("|"));
    Assert.areEqual("Started,Refused,NoHistory", Object.values(WebViewNavigationKind).join(","));
  }

  @TestMethod
  public carriesAnOriginOnlyForARefusal(): void {
    Assert.throws(() => new WebViewNavigation(WebViewNavigationKind.Refused), ArgumentException);
    Assert.throws(() => new WebViewNavigation(WebViewNavigationKind.Started, "https://example.net"), ArgumentException);
    Assert.areEqual("$.origin", Assert.throws(() => WebViewNavigation.fromJson({ kind: "NoHistory", origin: "https://example.net" }), JsonException).path);
    Assert.areEqual("$.kind", Assert.throws(() => WebViewNavigation.fromJson({ kind: "loaded" }), JsonException).path);
  }
}
