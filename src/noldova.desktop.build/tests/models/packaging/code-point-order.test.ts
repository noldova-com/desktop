/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { CodePointOrder } from "../../../src/models/packaging/code-point-order.js";

@TestClass
export class CodePointOrderTests {
  @TestMethod
  public ordersNamesByCodePointWhereALocaleWouldOrderThemOtherwise(): void {
    const names = ["zebra", "\u{1F600}", "a", "�", "Zebra", "éclair", "eclair", "b", "@scope/a", "a-b", "a_b", "ab", "B"];

    Assert.areEqual(JSON.stringify(["@scope/a", "B", "Zebra", "a", "a-b", "a_b", "ab", "b", "eclair", "zebra", "éclair", "�", "\u{1F600}"]),
      JSON.stringify(names.sort(CodePointOrder.compare)));
  }

  @TestMethod
  public putsANameBeforeTheLongerNamesItStartsAndCallsEqualNamesEqual(): void {
    Assert.isTrue(CodePointOrder.compare("sample", "sample-app") < 0);
    Assert.isTrue(CodePointOrder.compare("sample-app", "sample") > 0);
    Assert.areEqual(0, CodePointOrder.compare("sample", "sample"));
  }
}
