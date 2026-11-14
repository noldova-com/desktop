/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { TerminalSize } from "../../src/models/terminal-size.js";

@TestClass
export class TerminalSizeTests {
  @TestMethod
  public acceptsWholeColumnsAndRowsOfAtLeastOne(): void {
    Assert.doesNotThrow(() => TerminalSize.check(1, 1));
    Assert.doesNotThrow(() => TerminalSize.check(120, 40));
  }

  @TestMethod
  @TestData(0)
  @TestData(-1)
  @TestData(1.5)
  @TestData(Number.NaN)
  public refusesColumnsThatAreNotAWholeNumberOfAtLeastOne(columns: number): void {
    const exception = Assert.throws(() => TerminalSize.check(columns, 24), ArgumentException);

    Assert.areEqual("columns", exception.parameterName);
  }

  @TestMethod
  @TestData(0)
  @TestData(-1)
  @TestData(2.5)
  @TestData(Number.POSITIVE_INFINITY)
  public refusesRowsThatAreNotAWholeNumberOfAtLeastOne(rows: number): void {
    const exception = Assert.throws(() => TerminalSize.check(80, rows), ArgumentException);

    Assert.areEqual("rows", exception.parameterName);
  }
}
