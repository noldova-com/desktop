/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionAccessException, PermissionsModuleOnlyException } from "@noldova/desktop.runtime";

@TestClass
export class PermissionsModuleOnlyExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new PermissionsModuleOnlyException("notes", new ExceptionOptions(cause));

    Assert.areEqual("The module notes cannot answer permission requests or manage remembered answers; only the module the app names in desktop.product.permissionsModule can.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, PermissionAccessException);
    Assert.areEqual("PermissionsModuleOnlyException", exception.name);
  }
}
