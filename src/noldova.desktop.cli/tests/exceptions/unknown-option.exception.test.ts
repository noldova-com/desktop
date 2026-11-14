/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { UnknownOptionException } from "../../src/exceptions/unknown-option.exception.js";

@TestClass
export class UnknownOptionExceptionTests {
  @TestMethod
  public namesTheUnknownOption(): void {
    const exception = new UnknownOptionException("--bogus");

    Assert.areEqual("\"--bogus\" is not an option.", exception.message);
    Assert.areEqual("--bogus", exception.option);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("UnknownOptionException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
