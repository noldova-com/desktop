/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ModuleDatabaseException } from "@noldova/desktop.runtime";

@TestClass
export class ModuleDatabaseExceptionTests {
  @TestMethod
  public namesTheModuleWithoutADatabase(): void {
    const exception = new ModuleDatabaseException("notes");

    Assert.areEqual("The module notes has no database, because its runtime part declares no migrations.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("ModuleDatabaseException", exception.name);
  }
}
