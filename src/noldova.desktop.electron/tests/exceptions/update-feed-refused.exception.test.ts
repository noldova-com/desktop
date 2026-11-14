/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateException, UpdateFeedRefusedException } from "@noldova/desktop.electron";

@TestClass
export class UpdateFeedRefusedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const status = 404;

    const failure = new UpdateFeedRefusedException(status);

    Assert.areEqual("The update feed answered with HTTP status 404.", failure.message);
    Assert.areEqual(status, failure.status);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateFeedRefusedException", failure.name);
    Assert.isInstanceOf(failure, UpdateException);
  }
}
