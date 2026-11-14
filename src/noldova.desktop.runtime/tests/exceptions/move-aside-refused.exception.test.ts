/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { LaunchException, MoveAsideRefusedException } from "@noldova/desktop.runtime";

@TestClass
export class MoveAsideRefusedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const failure = new Failure(FailureCode.Conflict, "The backups folder is in use.");

    const exception = new MoveAsideRefusedException(failure);

    Assert.areEqual("The runtime could not move the old data aside: The backups folder is in use.", exception.message);
    Assert.areEqual(failure, exception.failure);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("MoveAsideRefusedException", exception.name);
  }
}
