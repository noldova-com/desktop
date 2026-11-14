/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { JobAssignmentFailedException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class JobAssignmentFailedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new JobAssignmentFailedException(4100, 5);

    Assert.areEqual("Process 4100 could not be put in a job of its own, with Windows error 5, so what it starts is found only by its parent.", exception.message);
    Assert.areEqual(4100, exception.processId);
    Assert.areEqual(5, exception.errorCode);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("JobAssignmentFailedException", exception.name);
  }
}
