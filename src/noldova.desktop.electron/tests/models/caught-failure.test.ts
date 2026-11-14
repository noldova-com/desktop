/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { CaughtFailure } from "../../src/models/caught-failure.js";

@TestClass
export class CaughtFailureTests {
  @TestMethod
  public returnsTheSameFailureWhenItIsOfTheExpectedType(): void {
    const failure = new SyntaxError("The pattern is invalid.");

    Assert.areEqual(failure, CaughtFailure.expect(failure, SyntaxError));
  }

  @TestMethod
  public rethrowsTheSameFailureWhenItIsOfAnotherType(): void {
    const failure = new RangeError("The value is out of range.");

    const error = Assert.throws(() => CaughtFailure.expect(failure, SyntaxError), RangeError);

    Assert.areEqual(failure, error);
  }
}
