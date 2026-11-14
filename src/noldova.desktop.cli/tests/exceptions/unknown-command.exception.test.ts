/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { UnknownCommandException } from "../../src/exceptions/unknown-command.exception.js";

@TestClass
export class UnknownCommandExceptionTests {
  @TestMethod
  public namesTheUnknownCommand(): void {
    const exception = new UnknownCommandException("nope");

    Assert.areEqual("\"nope\" is not a command.", exception.message);
    Assert.areEqual("nope", exception.command);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("UnknownCommandException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
