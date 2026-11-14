/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { UnknownModuleCommandException } from "../../src/exceptions/unknown-module-command.exception.js";

@TestClass
export class UnknownModuleCommandExceptionTests {
  @TestMethod
  public namesTheWordAndTheModule(): void {
    const exception = new UnknownModuleCommandException("nope", "probe");

    Assert.areEqual("\"nope\" is not a command of probe.", exception.message);
    Assert.areEqual("nope", exception.command);
    Assert.areEqual("probe", exception.moduleId);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("UnknownModuleCommandException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
