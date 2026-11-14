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
import { AnswererRegisteredException, RegistrationException } from "@noldova/desktop.runtime";

@TestClass
export class AnswererRegisteredExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new AnswererRegisteredException("notes", new ExceptionOptions(cause));

    Assert.areEqual("The module notes already registered an answerer for permission requests.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("AnswererRegisteredException", exception.name);
  }
}
