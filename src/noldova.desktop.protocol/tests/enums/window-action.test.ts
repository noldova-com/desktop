/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WindowAction } from "@noldova/desktop.protocol";

@TestClass
export class WindowActionTests {
  @TestMethod
  public namesEveryActionByItsMember(): void {
    Assert.areEqual("Minimize,ToggleMaximized,Close", Object.values(WindowAction).join(","));
  }
}
