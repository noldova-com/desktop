/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { JobClosedBeforeExitException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class JobClosedBeforeExitExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new JobClosedBeforeExitException(4100);

    Assert.areEqual("The job of process 4100 closed before its exit code was read.", exception.message);
    Assert.areEqual(4100, exception.processId);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("JobClosedBeforeExitException", exception.name);
  }
}
