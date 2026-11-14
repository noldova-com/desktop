/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { TimeoutInvalidException } from "../../src/exceptions/timeout-invalid.exception.js";

@TestClass
export class TimeoutInvalidExceptionTests {
  @TestMethod
  public statesTheTimeoutRange(): void {
    const exception = new TimeoutInvalidException("0");

    Assert.areEqual("The --timeout option takes a whole number of seconds from 1 to 3600.", exception.message);
    Assert.areEqual("0", exception.value);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("TimeoutInvalidException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
