/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DesktopProtocolException, FailureCode, ProtocolException } from "@noldova/desktop.protocol";

@TestClass
export class ProtocolExceptionTests {
  @TestMethod
  public namesTheMaximumLengthAndCarriesTheCodeAndTheCause(): void {
    const cause = new Error("cause");
    const exception = new ProtocolException(1024, new ExceptionOptions(cause));

    Assert.areEqual(FailureCode.FrameTooLarge, exception.code);
    Assert.areEqual(1024, exception.maximumFrameLength);
    Assert.areEqual("A frame exceeds the maximum length of 1024 characters.", exception.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.areEqual("ProtocolException", exception.name);
    Assert.isInstanceOf(exception, DesktopProtocolException);
    Assert.isInstanceOf(exception, Exception);
  }

  @TestMethod
  public hasNoCauseWhenGivenNone(): void {
    const exception = new ProtocolException(4);

    Assert.areEqual("A frame exceeds the maximum length of 4 characters.", exception.message);
    Assert.isUndefined(exception.cause);
  }
}
