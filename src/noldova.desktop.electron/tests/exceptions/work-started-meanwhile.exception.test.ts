/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateStopException, WorkStartedMeanwhileException } from "@noldova/desktop.electron";

@TestClass
export class WorkStartedMeanwhileExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const work = ["Saving notes (/data)", "Export (/data)"];

    const failure = new WorkStartedMeanwhileException(work);

    Assert.areEqual("Work started while Noldova Desktop Sample prepared to update: Saving notes (/data); Export (/data)", failure.message);
    Assert.areEqual(work, failure.work);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("WorkStartedMeanwhileException", failure.name);
    Assert.isInstanceOf(failure, UpdateStopException);
  }
}
