/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ExitCodeUnreadableException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class ExitCodeUnreadableExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new ExitCodeUnreadableException(4100);

    Assert.areEqual("Windows gave no exit code for process 4100.", exception.message);
    Assert.areEqual(4100, exception.processId);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("ExitCodeUnreadableException", exception.name);
  }
}
