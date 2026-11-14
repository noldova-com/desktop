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
import { LaunchException, LaunchStartFailedException } from "@noldova/desktop.runtime";

@TestClass
export class LaunchStartFailedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const cause = new Error("ENOENT");

    const exception = new LaunchStartFailedException("/opt/sample/sample", new ExceptionOptions(cause));

    Assert.areEqual("The program /opt/sample/sample could not be started.", exception.message);
    Assert.areEqual("/opt/sample/sample", exception.program);
    Assert.areEqual(cause, exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("LaunchStartFailedException", exception.name);
  }
}
