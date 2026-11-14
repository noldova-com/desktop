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
import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";

@TestClass
export class WebViewFailureTests {
  @TestMethod
  public pinsItsWireFormForEveryKind(): void {
    for (const kind of Object.values(WebViewFailureKind).filter(t => t !== WebViewFailureKind.Protocol))
      Assert.areEqual(`{"kind":"${kind}"}`, JSON.stringify(WebViewFailure.fromJson({ kind }).toJson()));
    Assert.areEqual("{\"kind\":\"Protocol\",\"code\":-32601,\"message\":\"Not found\"}", JSON.stringify(new WebViewFailure(WebViewFailureKind.Protocol, -32601, "Not found").toJson()));
    Assert.areEqual("NotOwned,NotAllowed,ShortcutRefused,TimedOut,TooLarge,ViewClosed,Crashed,ProfileCleared,Unavailable,Protocol", Object.values(WebViewFailureKind).join(","));
  }

  @TestMethod
  public carriesACodeAndAMessageOnlyForAProtocolFailure(): void {
    Assert.throws(() => new WebViewFailure(WebViewFailureKind.Protocol), ArgumentException);
    Assert.throws(() => new WebViewFailure(WebViewFailureKind.Protocol, 1), ArgumentException);
    Assert.throws(() => new WebViewFailure(WebViewFailureKind.TimedOut, 1, "late"), ArgumentException);
    Assert.areEqual("$.code", Assert.throws(() => WebViewFailure.fromJson({ kind: "Protocol", code: 1.5, message: "m" }), JsonException).path);
  }
}
