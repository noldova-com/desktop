/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { ArgumentsInvalidException } from "../../src/exceptions/arguments-invalid.exception.js";

@TestClass
export class ArgumentsInvalidExceptionTests {
  @TestMethod
  public givesTheReasonAndKeepsTheCause(): void {
    const cause = new Error("Unexpected end of JSON input");

    const exception = new ArgumentsInvalidException(cause);

    Assert.areEqual("The command's arguments are not valid JSON: Unexpected end of JSON input", exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("ArgumentsInvalidException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
