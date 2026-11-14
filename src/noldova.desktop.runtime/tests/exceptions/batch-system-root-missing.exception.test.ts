/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BatchSystemRootMissingException, ProcessStartException } from "@noldova/desktop.runtime";

@TestClass
export class BatchSystemRootMissingExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new BatchSystemRootMissingException();

    Assert.areEqual("SystemRoot is not set, so the Windows system tools cannot be found.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("BatchSystemRootMissingException", exception.name);
  }
}
