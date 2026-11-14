/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { OptionNotForModuleCommandsException } from "../../src/exceptions/option-not-for-module-commands.exception.js";

@TestClass
export class OptionNotForModuleCommandsExceptionTests {
  @TestMethod
  public namesTheOptionModuleCommandsRefuse(): void {
    const exception = new OptionNotForModuleCommandsException("--arguments-file");

    Assert.areEqual("The --arguments-file option does not apply to module commands.", exception.message);
    Assert.areEqual("--arguments-file", exception.option);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("OptionNotForModuleCommandsException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
