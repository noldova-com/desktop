/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateHolderNotFoundException, UpdateStopException } from "@noldova/desktop.electron";

@TestClass
export class UpdateHolderNotFoundExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new UpdateHolderNotFoundException();

    Assert.areEqual("Noldova Desktop Sample could not find its own process in the process table.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateHolderNotFoundException", failure.name);
    Assert.isInstanceOf(failure, UpdateStopException);
  }
}
