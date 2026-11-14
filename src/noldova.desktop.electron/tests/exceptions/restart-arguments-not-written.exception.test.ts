/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RestartArgumentsNotWrittenException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class RestartArgumentsNotWrittenExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("EACCES: permission denied");

    const failure = new RestartArgumentsNotWrittenException(new ExceptionOptions(cause));

    Assert.areEqual("Noldova Desktop Sample couldn't keep its data and device folders for the new version, so the update wasn't installed.", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("RestartArgumentsNotWrittenException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
