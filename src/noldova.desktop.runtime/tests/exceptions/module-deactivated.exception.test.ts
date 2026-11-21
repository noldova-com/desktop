/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ModuleDeactivatedException, RuntimeException } from "@noldova/desktop.runtime";

@TestClass
export class ModuleDeactivatedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsModule(): void {
    const exception = new ModuleDeactivatedException("notes");

    Assert.areEqual("The module notes has deactivated, so it opens no new tool session.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.isInstanceOf(exception, RuntimeException);
    Assert.areEqual("ModuleDeactivatedException", exception.name);
  }
}
