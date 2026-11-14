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
import { ServiceAccessException, ServiceNotAllowedException } from "@noldova/desktop.runtime";

@TestClass
export class ServiceNotAllowedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new ServiceNotAllowedException("notes", "tasks.store", new ExceptionOptions(cause));

    Assert.areEqual("The module notes may use only the shell's services and those of the modules it depends on, not tasks.store.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("tasks.store", exception.service);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, ServiceAccessException);
    Assert.areEqual("ServiceNotAllowedException", exception.name);
  }
}
