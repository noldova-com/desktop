/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, ProgramNotFoundException } from "@noldova/desktop.runtime";

@TestClass
export class ProgramNotFoundExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new ProgramNotFoundException("git");

    Assert.areEqual("git was not found, or it is not a program that can be run.", exception.message);
    Assert.areEqual("git", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("ProgramNotFoundException", exception.name);
  }
}
