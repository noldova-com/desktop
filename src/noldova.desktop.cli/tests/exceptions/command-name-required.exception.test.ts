/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { CommandNameRequiredException } from "../../src/exceptions/command-name-required.exception.js";

@TestClass
export class CommandNameRequiredExceptionTests {
  @TestMethod
  public saysTheRunCommandNeedsAName(): void {
    const exception = new CommandNameRequiredException();

    Assert.areEqual("The run command needs the name of a command to run.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("CommandNameRequiredException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
