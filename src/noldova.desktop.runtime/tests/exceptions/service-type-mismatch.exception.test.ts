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
import { ServiceAccessException, ServiceTypeMismatchException } from "@noldova/desktop.runtime";

@TestClass
export class ServiceTypeMismatchExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new ServiceTypeMismatchException("tasks.store", "TaskStore", new ExceptionOptions(cause));

    Assert.areEqual("The service tasks.store is not a TaskStore.", exception.message);
    Assert.areEqual("tasks.store", exception.service);
    Assert.areEqual("TaskStore", exception.type);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, ServiceAccessException);
    Assert.areEqual("ServiceTypeMismatchException", exception.name);
  }
}
