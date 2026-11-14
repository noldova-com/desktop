/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateStopException, UpdateUnderWayException } from "@noldova/desktop.electron";

@TestClass
export class UpdateUnderWayExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new UpdateUnderWayException();

    Assert.areEqual("Another update of Noldova Desktop Sample is under way.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateUnderWayException", failure.name);
    Assert.isInstanceOf(failure, UpdateStopException);
  }
}
