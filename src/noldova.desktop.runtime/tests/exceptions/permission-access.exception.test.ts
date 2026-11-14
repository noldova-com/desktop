/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { PermissionAccessException, PermissionsClosedException, PermissionsModuleOnlyException, RuntimeException } from "@noldova/desktop.runtime";

@TestClass
export class PermissionAccessExceptionTests {
  @TestMethod
  public isTheCategoryOfEachRefusedPermissionAccess(): void {
    const exceptions: readonly RuntimeException[] = [
      new PermissionsClosedException(),
      new PermissionsModuleOnlyException("notes")
    ];

    for (const exception of exceptions)
      Assert.isInstanceOf(exception, PermissionAccessException, exception.name);
  }
}
