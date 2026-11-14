/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ToolFailure, ToolFailureCode, ToolFailureException } from "@noldova/desktop.runtime";

@TestClass
export class ToolFailureExceptionTests {
  @TestMethod
  public carriesTheFailureToEndTheCallWith(): void {
    const failure = new ToolFailure(ToolFailureCode.Refused, "The note is outside the notebook.", "notes.outsideNotebook");

    const exception = new ToolFailureException(failure);

    Assert.areEqual("The note is outside the notebook.", exception.message);
    Assert.areEqual(failure, exception.failure);
    Assert.areEqual("ToolFailureException", exception.name);
    Assert.isUndefined(exception.cause);
  }

  @TestMethod
  public keepsTheErrorThatCausedTheFailure(): void {
    const cause = new Error("EBUSY: the notes file is held.");

    const exception = new ToolFailureException(new ToolFailure(ToolFailureCode.Unavailable, "The note couldn't be read."), { cause });

    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("The note couldn't be read.", exception.message);
  }
}
