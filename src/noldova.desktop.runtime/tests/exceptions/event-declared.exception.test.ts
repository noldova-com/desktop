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
import { EventDeclaredException, RegistrationException } from "@noldova/desktop.runtime";

@TestClass
export class EventDeclaredExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new EventDeclaredException("notes.saved", new ExceptionOptions(cause));

    Assert.areEqual("The event notes.saved is already declared.", exception.message);
    Assert.areEqual("notes.saved", exception.event);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("EventDeclaredException", exception.name);
  }
}
