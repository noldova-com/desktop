/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DesktopProtocolException, ProtocolException } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";

@TestClass
export class DesktopProtocolExceptionTests {
  @TestMethod
  public isTheBaseOfEveryExceptionThePackageOwns(): void {
    for (const exception of [new ProtocolException(1024), new UnansweredCallException("readSetting")]) {
      Assert.isInstanceOf(exception, DesktopProtocolException);
      Assert.isInstanceOf(exception, Exception);
    }
  }
}
