/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeStarterFailedException } from "@noldova/desktop.electron";
import { LaunchException } from "@noldova/desktop.runtime";

@TestClass
export class RuntimeStarterFailedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = "the runtime file is missing";

    const exception = new RuntimeStarterFailedException(failure);

    Assert.areEqual("The runtime starter could not start the runtime: the runtime file is missing", exception.message);
    Assert.areEqual(failure, exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("RuntimeStarterFailedException", exception.name);
    Assert.isInstanceOf(exception, LaunchException);
  }
}
