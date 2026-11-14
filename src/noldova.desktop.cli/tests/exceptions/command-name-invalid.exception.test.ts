/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { CommandNameInvalidException } from "../../src/exceptions/command-name-invalid.exception.js";

@TestClass
export class CommandNameInvalidExceptionTests {
  @TestMethod
  public givesTheParsersReasonAndKeepsTheCause(): void {
    const cause = new Error("Unexpected end of JSON input");

    const exception = new CommandNameInvalidException("probe", cause);

    Assert.areEqual("Unexpected end of JSON input", exception.message);
    Assert.areEqual("probe", exception.commandName);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("CommandNameInvalidException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
