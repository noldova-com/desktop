/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ForegroundGroupUnreadableException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class ForegroundGroupUnreadableExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new ForegroundGroupUnreadableException(812, "812 (bash) S");

    Assert.areEqual("The foreground process group of process 812's terminal could not be read from: 812 (bash) S", exception.message);
    Assert.areEqual(812, exception.processId);
    Assert.areEqual("812 (bash) S", exception.output);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("ForegroundGroupUnreadableException", exception.name);
  }
}
