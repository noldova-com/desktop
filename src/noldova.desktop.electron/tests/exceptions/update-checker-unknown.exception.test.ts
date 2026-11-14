/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateCheckerUnknownException, UpdateException } from "@noldova/desktop.electron";

@TestClass
export class UpdateCheckerUnknownExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new UpdateCheckerUnknownException();

    Assert.areEqual("The main process could not identify its own process, so it cannot check for updates.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateCheckerUnknownException", failure.name);
    Assert.isInstanceOf(failure, UpdateException);
  }
}
