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
import { RegistrationException, ToolRegisteredException } from "@noldova/desktop.runtime";

@TestClass
export class ToolRegisteredExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new ToolRegisteredException("notes.search", new ExceptionOptions(cause));

    Assert.areEqual("The tool notes.search is already registered.", exception.message);
    Assert.areEqual("notes.search", exception.tool);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("ToolRegisteredException", exception.name);
  }
}
