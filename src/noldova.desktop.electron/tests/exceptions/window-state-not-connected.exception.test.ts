/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WindowStateException, WindowStateNotConnectedException, WindowStateUnavailableException } from "@noldova/desktop.electron";

@TestClass
export class WindowStateNotConnectedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new WindowStateNotConnectedException();

    Assert.areEqual("Noldova Desktop Sample is not connected to its runtime.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("WindowStateNotConnectedException", failure.name);
    Assert.isInstanceOf(failure, WindowStateUnavailableException);
    Assert.isInstanceOf(failure, WindowStateException);
  }
}
