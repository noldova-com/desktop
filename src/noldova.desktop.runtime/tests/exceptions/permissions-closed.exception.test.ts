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
import { PermissionAccessException, PermissionsClosedException } from "@noldova/desktop.runtime";

@TestClass
export class PermissionsClosedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new PermissionsClosedException(new ExceptionOptions(cause));

    Assert.areEqual("Noldova Desktop's database is not open.", exception.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, PermissionAccessException);
    Assert.areEqual("PermissionsClosedException", exception.name);
  }
}
