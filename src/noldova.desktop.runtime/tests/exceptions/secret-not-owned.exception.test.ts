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
import { RegistrationException, SecretNotOwnedException } from "@noldova/desktop.runtime";

@TestClass
export class SecretNotOwnedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new SecretNotOwnedException("notes", "tasks.token", new ExceptionOptions(cause));

    Assert.areEqual("The module notes may only use its own secrets, not tasks.token.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("tasks.token", exception.secret);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("SecretNotOwnedException", exception.name);
  }
}
