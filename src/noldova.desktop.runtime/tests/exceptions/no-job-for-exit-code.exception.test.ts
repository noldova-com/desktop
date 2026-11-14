/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { NoJobForExitCodeException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class NoJobForExitCodeExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new NoJobForExitCodeException(4100);

    Assert.areEqual("Process 4100 is in no job of the runtime's, so Windows wasn't asked for its exit code.", exception.message);
    Assert.areEqual(4100, exception.processId);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("NoJobForExitCodeException", exception.name);
  }
}
