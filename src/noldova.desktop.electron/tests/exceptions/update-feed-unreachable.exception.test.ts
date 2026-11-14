/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateException, UpdateFeedUnreachableException } from "@noldova/desktop.electron";

@TestClass
export class UpdateFeedUnreachableExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("EACCES: permission denied");

    const failure = new UpdateFeedUnreachableException(new ExceptionOptions(cause));

    Assert.areEqual("Noldova Desktop Sample couldn't reach its update feed.", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("UpdateFeedUnreachableException", failure.name);
    Assert.isInstanceOf(failure, UpdateException);
  }
}
