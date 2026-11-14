/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { OptionNotForCommandException } from "../../src/exceptions/option-not-for-command.exception.js";

@TestClass
export class OptionNotForCommandExceptionTests {
  @TestMethod
  public namesTheOptionAndTheCommand(): void {
    const exception = new OptionNotForCommandException("--timeout", "status");

    Assert.areEqual("The --timeout option does not apply to status.", exception.message);
    Assert.areEqual("--timeout", exception.option);
    Assert.areEqual("status", exception.command);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("OptionNotForCommandException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
