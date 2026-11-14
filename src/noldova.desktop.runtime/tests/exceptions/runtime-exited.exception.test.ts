/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { LaunchException, RuntimeExitedException } from "@noldova/desktop.runtime";

@TestClass
export class RuntimeExitedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new RuntimeExitedException("The data directory is read-only.");

    Assert.areEqual("The runtime exited while starting: The data directory is read-only.", exception.message);
    Assert.areEqual("The data directory is read-only.", exception.output);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("RuntimeExitedException", exception.name);
  }
}
