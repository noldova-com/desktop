/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { CommandRequiredException } from "../../src/exceptions/command-required.exception.js";

@TestClass
export class CommandRequiredExceptionTests {
  @TestMethod
  public saysACommandIsRequired(): void {
    const exception = new CommandRequiredException();

    Assert.areEqual("A command is required.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("CommandRequiredException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
