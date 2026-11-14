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
import { SettingException, SettingValueInvalidException } from "@noldova/desktop.runtime";

@TestClass
export class SettingValueInvalidExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new SettingValueInvalidException("chat.send", new ExceptionOptions(cause));

    Assert.areEqual("The value is not one the setting chat.send accepts.", exception.message);
    Assert.areEqual("chat.send", exception.setting);
    Assert.areEqual(FailureCode.InvalidParams, exception.failure.code);
    Assert.areEqual("The value is not one the setting chat.send accepts.", exception.failure.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, SettingException);
    Assert.areEqual("SettingValueInvalidException", exception.name);
  }
}
