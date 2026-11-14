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
import { RegistrationException, SettingScopeNotOwnedException } from "@noldova/desktop.runtime";

@TestClass
export class SettingScopeNotOwnedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new SettingScopeNotOwnedException("notes", "tasks.board", new ExceptionOptions(cause));

    Assert.areEqual("The module notes may only describe the scopes it declares, its dependencies' as parents, not tasks.board.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("tasks.board", exception.scope);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("SettingScopeNotOwnedException", exception.name);
  }
}
