/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeException, ServiceAccessException, ServiceMissingException, ServiceNotAllowedException, ServiceTypeMismatchException } from "@noldova/desktop.runtime";

@TestClass
export class ServiceAccessExceptionTests {
  @TestMethod
  public isTheCategoryOfEachRefusedService(): void {
    const exceptions: readonly RuntimeException[] = [
      new ServiceNotAllowedException("notes", "tasks.store"),
      new ServiceMissingException("tasks.store"),
      new ServiceTypeMismatchException("tasks.store", "TaskStore")
    ];

    for (const exception of exceptions)
      Assert.isInstanceOf(exception, ServiceAccessException, exception.name);
  }
}
