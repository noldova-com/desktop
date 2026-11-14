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
import { RegistrationException, ServiceNotOwnedException } from "@noldova/desktop.runtime";

@TestClass
export class ServiceNotOwnedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new ServiceNotOwnedException("notes", "tasks.store", new ExceptionOptions(cause));

    Assert.areEqual("The module notes may publish services only under its own id, not tasks.store.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("tasks.store", exception.service);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("ServiceNotOwnedException", exception.name);
  }
}
