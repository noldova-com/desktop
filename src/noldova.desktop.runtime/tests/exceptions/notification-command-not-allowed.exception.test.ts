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
import { NotificationCommandNotAllowedException, RegistrationException } from "@noldova/desktop.runtime";

@TestClass
export class NotificationCommandNotAllowedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new NotificationCommandNotAllowedException("notes", "tasks.open", new ExceptionOptions(cause));

    Assert.areEqual("The module notes may not offer the command tasks.open in a notification; it must be its own or a dependency's.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("tasks.open", exception.command);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("NotificationCommandNotAllowedException", exception.name);
  }
}
