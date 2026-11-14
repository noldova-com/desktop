/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { ArgumentRequiredException } from "../../src/exceptions/argument-required.exception.js";

@TestClass
export class ArgumentRequiredExceptionTests {
  @TestMethod
  public namesTheRequiredArgument(): void {
    const exception = new ArgumentRequiredException("<title>");

    Assert.areEqual("The <title> argument is required.", exception.message);
    Assert.areEqual("<title>", exception.placeholder);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("ArgumentRequiredException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
