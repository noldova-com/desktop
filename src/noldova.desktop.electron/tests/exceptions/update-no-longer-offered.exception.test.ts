/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { StaleUpdateException, UpdateHandoffException, UpdateNoLongerOfferedException } from "@noldova/desktop.electron";

@TestClass
export class UpdateNoLongerOfferedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const version = "1.3.0";

    const failure = new UpdateNoLongerOfferedException(version);

    Assert.areEqual("The update feed no longer offers version 1.3.0.", failure.message);
    Assert.areEqual(version, failure.version);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateNoLongerOfferedException", failure.name);
    Assert.isInstanceOf(failure, StaleUpdateException);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
