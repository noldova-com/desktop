/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { WindowPage } from "../../src/models/window-page.js";

@TestClass
export class WindowPageTests {
  @TestMethod
  public keepsItsIdAndSerial(): void {
    const page = new WindowPage("workspace", 3);
    const unnamed = new WindowPage(null, 4);

    Assert.areEqual("workspace|3|null|4", `${page.id}|${page.serial}|${unnamed.id}|${unnamed.serial}`);
  }

  @TestMethod
  public abortsItsSignalWhenItEnds(): void {
    const page = new WindowPage("workspace", 1);
    const signal = page.signal;
    let aborts = 0;
    signal.addEventListener("abort", () => aborts++);

    const before = signal.aborted;
    page.end();

    Assert.isFalse(before);
    Assert.isTrue(signal.aborted);
    Assert.areEqual(1, aborts);
    Assert.isTrue(signal === page.signal, "the page keeps one signal");
  }

  @TestMethod
  public givesEachPageItsOwnSignal(): void {
    const ended = new WindowPage("a", 1);
    const open = new WindowPage("b", 2);

    ended.end();

    Assert.isFalse(open.signal.aborted);
  }
}
