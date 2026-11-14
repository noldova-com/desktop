/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeStarterEndedException } from "@noldova/desktop.electron";
import { LaunchException } from "@noldova/desktop.runtime";

@TestClass
export class RuntimeStarterEndedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new RuntimeStarterEndedException();

    Assert.areEqual("The runtime starter ended before it started the runtime.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("RuntimeStarterEndedException", failure.name);
    Assert.isInstanceOf(failure, LaunchException);
  }
}
