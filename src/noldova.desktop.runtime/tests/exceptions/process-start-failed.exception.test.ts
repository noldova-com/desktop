/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessStartException, ProcessStartFailedException } from "@noldova/desktop.runtime";

@TestClass
export class ProcessStartFailedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const cause = new Error("ENOENT");

    const exception = new ProcessStartFailedException("/usr/bin/git", new ExceptionOptions(cause));

    Assert.areEqual("/usr/bin/git could not be started.", exception.message);
    Assert.areEqual("/usr/bin/git", exception.program);
    Assert.areEqual(cause, exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("ProcessStartFailedException", exception.name);
  }
}
