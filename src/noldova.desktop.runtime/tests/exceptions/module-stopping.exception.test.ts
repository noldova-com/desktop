/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ModuleStoppingException, ProcessStartException } from "@noldova/desktop.runtime";

@TestClass
export class ModuleStoppingExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new ModuleStoppingException("notes", "git");

    Assert.areEqual("git was not started, because the module notes is stopping.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("git", exception.program);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof ProcessStartException);
    Assert.areEqual("ModuleStoppingException", exception.name);
  }
}
