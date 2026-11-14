/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";

@TestClass
export class MethodFailureExceptionTests {
  @TestMethod
  public carriesTheFailureToAnswer(): void {
    const failure = new Failure(FailureCode.NotFound, "The note does not exist.", { path: "notes.md" });

    const exception = new MethodFailureException(failure);

    Assert.areEqual("The note does not exist.", exception.message);
    Assert.areEqual(failure, exception.failure);
    Assert.areEqual("MethodFailureException", exception.name);
  }
}
