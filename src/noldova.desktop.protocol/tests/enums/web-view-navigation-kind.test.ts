/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WebViewNavigationKind } from "@noldova/desktop.protocol";

@TestClass
export class WebViewNavigationKindTests {
  @TestMethod
  public namesEveryKindByItsMember(): void {
    Assert.areEqual("Started,Refused,NoHistory", Object.values(WebViewNavigationKind).join(","));
  }
}
