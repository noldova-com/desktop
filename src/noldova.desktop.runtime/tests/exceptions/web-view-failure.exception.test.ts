/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { RuntimeException, WebViewFailureException } from "@noldova/desktop.runtime";

@TestClass
export class WebViewFailureExceptionTests {
  @TestMethod
  public takesTheFailuresMessage(): void {
    const failure = new WebViewFailure(WebViewFailureKind.Protocol, -32000, "Not allowed here.");

    const exception = new WebViewFailureException(failure);

    Assert.areEqual("Not allowed here.", exception.message);
    Assert.areEqual(failure, exception.failure);
    Assert.areEqual("WebViewFailureException", exception.name);
    Assert.isTrue(exception instanceof RuntimeException);
  }

  @TestMethod
  public namesTheKindWhenTheFailureHasNoMessage(): void {
    const exception = new WebViewFailureException(new WebViewFailure(WebViewFailureKind.ViewClosed));

    Assert.areEqual("The web view call failed: ViewClosed.", exception.message);
  }
}
