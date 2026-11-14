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
import { FailureCode } from "@noldova/desktop.protocol";
import { SettingException, SettingScopeNotAllowedException } from "@noldova/desktop.runtime";

@TestClass
export class SettingScopeNotAllowedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new SettingScopeNotAllowedException("chat.send", "chat.room", new ExceptionOptions(cause));

    Assert.areEqual("The setting chat.send does not list the scope chat.room.", exception.message);
    Assert.areEqual("chat.send", exception.setting);
    Assert.areEqual("chat.room", exception.scope);
    Assert.areEqual(FailureCode.InvalidParams, exception.failure.code);
    Assert.areEqual("The setting chat.send does not list the scope chat.room.", exception.failure.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, SettingException);
    Assert.areEqual("SettingScopeNotAllowedException", exception.name);
  }
}
