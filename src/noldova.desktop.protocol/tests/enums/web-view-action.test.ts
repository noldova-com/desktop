/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewAction } from "@noldova/desktop.protocol";

@TestClass
export class WebViewActionTests {
  @TestMethod
  public namesEveryActionByItsMember(): void {
    Assert.areEqual("List,Navigate,Back,Forward,Reload,Stop,SetAllowedOrigins,ClearProfile,Send", Object.values(WebViewAction).join(","));
  }
}
