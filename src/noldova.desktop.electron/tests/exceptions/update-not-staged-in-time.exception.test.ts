/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateHandoffException, UpdateNotStagedInTimeException } from "@noldova/desktop.electron";

@TestClass
export class UpdateNotStagedInTimeExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new UpdateNotStagedInTimeException();

    Assert.areEqual("macOS didn't prepare the update for installing within 2 minutes.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateNotStagedInTimeException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
