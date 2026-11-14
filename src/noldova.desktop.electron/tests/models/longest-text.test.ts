/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { LongestText } from "../../src/models/longest-text.js";

@TestClass
export class LongestTextTests {
  @TestMethod
  public shortensTheTextAtItsPathByTheExcessAndLeavesEveryOtherValue(): void {
    const params = { name: "frame", node: { title: "abcdefgh", count: 3, isOpen: true, none: null }, last: "kept" };

    const shortened = new LongestText(["node", "title"], "abcdefgh").shorten(params, 3);

    Assert.areEqual(JSON.stringify({ name: "frame", node: { title: "abcde", count: 3, isOpen: true, none: null }, last: "kept" }), JSON.stringify(shortened));
    Assert.areEqual("abcdefgh", params.node.title);
  }

  @TestMethod
  public shortensATextInsideAList(): void {
    const params = { items: ["one", { text: "a long text" }, "three"] };

    const shortened = new LongestText(["items", "1", "text"], "a long text").shorten(params, 5);

    Assert.areEqual(JSON.stringify({ items: ["one", { text: "a long" }, "three"] }), JSON.stringify(shortened));
  }

  @TestMethod
  public leavesAnEmptyTextWhenTheExcessIsLongerThanTheText(): void {
    const shortened = new LongestText(["text"], "abc").shorten({ text: "abc", other: "x" }, 10);

    Assert.areEqual(JSON.stringify({ text: "", other: "x" }), JSON.stringify(shortened));
  }

  @TestMethod
  public leavesAValueThatIsNotAContainerWhereThePathGoesOn(): void {
    const shortened = new LongestText(["value", "text"], "abc").shorten({ value: 7 }, 1);

    Assert.areEqual(JSON.stringify({ value: 7 }), JSON.stringify(shortened));
  }
}
