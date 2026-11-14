/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewFailureKind } from "@noldova/desktop.protocol";

@TestClass
export class WebViewFailureKindTests {
  @TestMethod
  public namesEveryKindByItsMember(): void {
    Assert.areEqual("NotOwned,NotAllowed,ShortcutRefused,TimedOut,TooLarge,ViewClosed,Crashed,ProfileCleared,Unavailable,Protocol", Object.values(WebViewFailureKind).join(","));
  }
}
