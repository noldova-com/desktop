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
import { RegistrationException, SettingNotReadableException } from "@noldova/desktop.runtime";

@TestClass
export class SettingNotReadableExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new SettingNotReadableException("notes", "tasks.speed", new ExceptionOptions(cause));

    Assert.areEqual("The module notes may only read its own settings, its dependencies' and the shell's, not tasks.speed.", exception.message);
    Assert.areEqual("notes", exception.moduleId);
    Assert.areEqual("tasks.speed", exception.setting);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, RegistrationException);
    Assert.areEqual("SettingNotReadableException", exception.name);
  }
}
