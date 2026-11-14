/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateException, UpdateFeedRedirectedException } from "@noldova/desktop.electron";

@TestClass
export class UpdateFeedRedirectedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new UpdateFeedRedirectedException();

    Assert.areEqual("The update feed redirected to an address with another protocol.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateFeedRedirectedException", failure.name);
    Assert.isInstanceOf(failure, UpdateException);
  }
}
