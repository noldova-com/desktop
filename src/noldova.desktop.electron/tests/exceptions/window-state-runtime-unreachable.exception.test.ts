/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WindowStateException, WindowStateRuntimeUnreachableException, WindowStateUnavailableException } from "@noldova/desktop.electron";
import { CallUnansweredException } from "@noldova/desktop.runtime";

@TestClass
export class WindowStateRuntimeUnreachableExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new CallUnansweredException("desktop.writeWindowBounds");

    const failure = new WindowStateRuntimeUnreachableException(cause);

    Assert.areEqual("The runtime did not answer desktop.writeWindowBounds in time.", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("WindowStateRuntimeUnreachableException", failure.name);
    Assert.isInstanceOf(failure, WindowStateUnavailableException);
    Assert.isInstanceOf(failure, WindowStateException);
  }
}
