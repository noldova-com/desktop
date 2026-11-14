/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { UnexpectedArgumentException } from "../../src/exceptions/unexpected-argument.exception.js";

@TestClass
export class UnexpectedArgumentExceptionTests {
  @TestMethod
  public namesTheUnexpectedArgument(): void {
    const exception = new UnexpectedArgumentException("extra");

    Assert.areEqual("\"extra\" was not expected.", exception.message);
    Assert.areEqual("extra", exception.argument);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("UnexpectedArgumentException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
