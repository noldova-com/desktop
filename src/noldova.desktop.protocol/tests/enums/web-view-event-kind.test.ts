/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewEventKind } from "@noldova/desktop.protocol";

@TestClass
export class WebViewEventKindTests {
  @TestMethod
  public namesEveryKindByItsMember(): void {
    Assert.areEqual("Opened,Closed,State,LoadFailed,NavigationRefused,FrameNavigationRefused,Crashed,ProfileCleared,RequestRefused,NewWindowRequested,Protocol,Dropped,Key,Zoom,Found,Favicon,Controlled", Object.values(WebViewEventKind).join(","));
  }
}
