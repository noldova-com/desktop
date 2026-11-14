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
import { SettingException, SettingUnknownException } from "@noldova/desktop.runtime";

@TestClass
export class SettingUnknownExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new SettingUnknownException("chat.send", new ExceptionOptions(cause));

    Assert.areEqual("No setting named chat.send is declared.", exception.message);
    Assert.areEqual("chat.send", exception.setting);
    Assert.areEqual(FailureCode.NotFound, exception.failure.code);
    Assert.areEqual("No setting named chat.send is declared.", exception.failure.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, SettingException);
    Assert.areEqual("SettingUnknownException", exception.name);
  }
}
