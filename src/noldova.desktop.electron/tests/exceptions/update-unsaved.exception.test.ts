/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateStopException, UpdateUnsavedException } from "@noldova/desktop.electron";

@TestClass
export class UpdateUnsavedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const dataDirectory = "/data";
    const problems = ["notes.md", "todo.md"];

    const failure = new UpdateUnsavedException(dataDirectory, problems);

    Assert.areEqual("Not everything of /data was saved: notes.md; todo.md", failure.message);
    Assert.areEqual(dataDirectory, failure.dataDirectory);
    Assert.areEqual(problems, failure.problems);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateUnsavedException", failure.name);
    Assert.isInstanceOf(failure, UpdateStopException);
  }
}
