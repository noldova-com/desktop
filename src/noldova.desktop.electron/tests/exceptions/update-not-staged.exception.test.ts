/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateHandoffException, UpdateNotStagedException } from "@noldova/desktop.electron";

@TestClass
export class UpdateNotStagedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("EACCES: permission denied");

    const failure = new UpdateNotStagedException(new ExceptionOptions(cause));

    Assert.areEqual("macOS couldn't prepare the update for installing.", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("UpdateNotStagedException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
