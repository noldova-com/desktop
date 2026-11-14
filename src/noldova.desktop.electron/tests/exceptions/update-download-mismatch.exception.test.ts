/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateDownloadMismatchException, UpdateException } from "@noldova/desktop.electron";

@TestClass
export class UpdateDownloadMismatchExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("EACCES: permission denied");

    const failure = new UpdateDownloadMismatchException(new ExceptionOptions(cause));

    Assert.areEqual("The download doesn't match the release.", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("UpdateDownloadMismatchException", failure.name);
    Assert.isInstanceOf(failure, UpdateException);
  }
}
