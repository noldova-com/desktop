/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ForegroundGroupReadFailedException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class ForegroundGroupReadFailedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const cause = new Error("EACCES");

    const exception = new ForegroundGroupReadFailedException(812, cause);

    Assert.areEqual("The foreground process group of process 812's terminal could not be read from: Error: EACCES", exception.message);
    Assert.areEqual(812, exception.processId);
    Assert.areEqual(cause, exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("ForegroundGroupReadFailedException", exception.name);
  }
}
