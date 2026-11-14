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
import { SettingException, SettingNeedsDeviceException } from "@noldova/desktop.runtime";

@TestClass
export class SettingNeedsDeviceExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new SettingNeedsDeviceException("chat.send", new ExceptionOptions(cause));

    Assert.areEqual("The setting chat.send is kept per device and needs a device.", exception.message);
    Assert.areEqual("chat.send", exception.setting);
    Assert.areEqual(FailureCode.InvalidParams, exception.failure.code);
    Assert.areEqual("The setting chat.send is kept per device and needs a device.", exception.failure.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, SettingException);
    Assert.areEqual("SettingNeedsDeviceException", exception.name);
  }
}
