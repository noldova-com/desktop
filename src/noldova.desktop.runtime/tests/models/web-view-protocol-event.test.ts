/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewProtocolEvent } from "@noldova/desktop.runtime";

@TestClass
export class WebViewProtocolEventTests {
  @TestMethod
  public keepsTheViewTheMethodTheParamsAndWhetherItWasCut(): void {
    const params = { url: "https://example.com/" };

    const event = new WebViewProtocolEvent("notes.preview", "Page.frameNavigated", params, true);

    Assert.areEqual("notes.preview", event.view);
    Assert.areEqual("Page.frameNavigated", event.method);
    Assert.areEqual(params, event.params);
    Assert.isTrue(event.isCut);
  }
}
