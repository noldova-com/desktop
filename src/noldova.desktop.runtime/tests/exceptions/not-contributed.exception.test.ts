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
import { NotContributedException, RegistrationException } from "@noldova/desktop.runtime";

@TestClass
export class NotContributedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new NotContributedException("notes", "commands", "notes.open", new ExceptionOptions(cause));

    Assert.areEqual("The module notes does not declare notes.open among its commands.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("commands", exception.kind);
    Assert.areEqual("notes.open", exception.contribution);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("NotContributedException", exception.name);
  }
}
