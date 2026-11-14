/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DesktopProtocolException } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";

@TestClass
export class UnansweredCallExceptionTests {
  @TestMethod
  public namesTheMemberAndHowToAnswerIt(): void {
    const exception = new UnansweredCallException("readSetting");

    Assert.areEqual("readSetting", exception.member);
    Assert.areEqual("The fake has no answer for readSetting; a test gives one with answer(\"readSetting\", …) before the code under test calls it.", exception.message);
    Assert.areEqual("UnansweredCallException", exception.name);
    Assert.isInstanceOf(exception, DesktopProtocolException);
    Assert.isInstanceOf(exception, Exception);
  }
}
