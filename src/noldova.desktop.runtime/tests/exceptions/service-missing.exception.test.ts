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
import { ServiceAccessException, ServiceMissingException } from "@noldova/desktop.runtime";

@TestClass
export class ServiceMissingExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new ServiceMissingException("tasks.store", new ExceptionOptions(cause));

    Assert.areEqual("No service tasks.store is published.", exception.message);
    Assert.areEqual("tasks.store", exception.service);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, ServiceAccessException);
    Assert.areEqual("ServiceMissingException", exception.name);
  }
}
