/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TextCap } from "../../src/models/text-cap.js";

@TestClass
export class TextCapTests {
  @TestMethod
  public cutsEveryLongerTextToTheCapInObjectsAndListsAndLeavesShorterTextsAndOtherValues(): void {
    const params = { name: "abcdef", short: "ab", count: 7, isOpen: true, none: null, items: ["xxxxx", { title: "yyyy" }] };

    const capped = new TextCap(3, 0).apply(params);

    Assert.areEqual(JSON.stringify({ name: "abc", short: "ab", count: 7, isOpen: true, none: null, items: ["xxx", { title: "yyy" }] }), JSON.stringify(capped));
    Assert.areEqual("abcdef", params.name);
  }

  @TestMethod
  public leavesOneCharacterMoreOnTheFirstTextsItCutsWhileItHasSpare(): void {
    const capped = new TextCap(2, 2).apply({ first: "aaaa", second: "bbbb", third: "cccc" });

    Assert.areEqual(JSON.stringify({ first: "aaa", second: "bbb", third: "cc" }), JSON.stringify(capped));
  }

  @TestMethod
  public dropsTheFirstHalfOfASurrogatePairThatTheCutWouldEndOn(): void {
    const capped = new TextCap(2, 0).apply({ text: "a\u{1F600}b", whole: "\u{1F600}cd" });

    Assert.areEqual(JSON.stringify({ text: "a", whole: "\u{1F600}" }), JSON.stringify(capped));
  }
}
