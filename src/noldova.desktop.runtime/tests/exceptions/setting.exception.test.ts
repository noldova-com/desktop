/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  MethodFailureException, SettingException, SettingNeedsDeviceException, SettingScopeNotAllowedException, SettingUnknownException, SettingValueInvalidException
} from "@noldova/desktop.runtime";

@TestClass
export class SettingExceptionTests {
  @TestMethod
  public isTheCategoryOfEachRefusedSetting(): void {
    const exceptions: readonly MethodFailureException[] = [
      new SettingUnknownException("chat.send"),
      new SettingValueInvalidException("chat.send"),
      new SettingScopeNotAllowedException("chat.send", "chat.room"),
      new SettingNeedsDeviceException("chat.send")
    ];

    for (const exception of exceptions)
      Assert.isInstanceOf(exception, SettingException, exception.name);
  }
}
