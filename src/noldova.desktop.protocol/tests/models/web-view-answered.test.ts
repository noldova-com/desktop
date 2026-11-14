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
import { WebViewAnswered, WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";

@TestClass
export class WebViewAnsweredTests {
  @TestMethod
  public pinsItsWireFormWithAValueOrAFailure(): void {
    const value = "{\"call\":2,\"value\":{\"kind\":\"Started\"}}";
    const failure = "{\"call\":2,\"failure\":{\"kind\":\"Protocol\",\"code\":-32000,\"message\":\"No node\"}}";

    Assert.areEqual(value, JSON.stringify(WebViewAnswered.fromJson(JsonReader.parse(value).toJson()).toJson()));
    Assert.areEqual(failure, JSON.stringify(WebViewAnswered.fromJson(JsonReader.parse(failure).toJson()).toJson()));
    Assert.areEqual("{\"call\":2}", JSON.stringify(new WebViewAnswered(2).toJson()));
    Assert.areEqual(WebViewFailureKind.Protocol, WebViewAnswered.fromJson(JsonReader.parse(failure).toJson()).failure?.kind);
  }

  @TestMethod
  public refusesBothAValueAndAFailure(): void {
    Assert.areEqual("value", Assert.throws(() => new WebViewAnswered(2, 1, new WebViewFailure(WebViewFailureKind.TimedOut)), ArgumentException).parameterName);
    Assert.areEqual("call", Assert.throws(() => new WebViewAnswered(-1), ArgumentException).parameterName);
    Assert.areEqual("$.failure.kind", Assert.throws(() => WebViewAnswered.fromJson({ call: 2, failure: { kind: "lost" } }), JsonException).path);
  }
}
