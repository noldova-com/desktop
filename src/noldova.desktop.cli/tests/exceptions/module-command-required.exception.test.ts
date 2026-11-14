/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { ModuleCommandRequiredException } from "../../src/exceptions/module-command-required.exception.js";

@TestClass
export class ModuleCommandRequiredExceptionTests {
  @TestMethod
  public namesTheModuleThatNeedsACommand(): void {
    const exception = new ModuleCommandRequiredException("probe");

    Assert.areEqual("probe needs one of its commands.", exception.message);
    Assert.areEqual("probe", exception.moduleId);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("ModuleCommandRequiredException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
