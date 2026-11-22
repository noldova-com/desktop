/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { WebViewKeyModifier } from "../../src/models/web-view-key-modifier.js";

@TestClass
export class WebViewKeyModifierTests {
  @TestMethod
  public isInTheFlagsOnlyWhenItsOwnBitIsSet(): void {
    const shift = new WebViewKeyModifier(8, "shift");

    Assert.areEqual("shift,true,true,false,false", [shift.name, shift.isIn(8), shift.isIn(9), shift.isIn(7), shift.isIn(0)].join(","));
  }
}
