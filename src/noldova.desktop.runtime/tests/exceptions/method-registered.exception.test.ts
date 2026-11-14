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
import { MethodRegisteredException, RegistrationException } from "@noldova/desktop.runtime";

@TestClass
export class MethodRegisteredExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new MethodRegisteredException("notes.open", new ExceptionOptions(cause));

    Assert.areEqual("The method notes.open is already registered.", exception.message);
    Assert.areEqual("notes.open", exception.method);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("MethodRegisteredException", exception.name);
  }
}
