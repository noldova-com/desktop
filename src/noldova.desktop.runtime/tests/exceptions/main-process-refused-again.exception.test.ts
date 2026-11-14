/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { LaunchException, MainProcessRefusedAgainException } from "@noldova/desktop.runtime";

@TestClass
export class MainProcessRefusedAgainExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new MainProcessRefusedAgainException();

    Assert.areEqual("The runtime refused this app's main process, also after the app restarted it from its own program.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("MainProcessRefusedAgainException", exception.name);
  }
}
