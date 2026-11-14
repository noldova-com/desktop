/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { StaleUpdateException, UpdateChangedBeforeHandoffException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class UpdateChangedBeforeHandoffExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new UpdateChangedBeforeHandoffException();

    Assert.areEqual("The downloaded update has changed since it was checked, so it wasn't installed.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("UpdateChangedBeforeHandoffException", failure.name);
    Assert.isInstanceOf(failure, StaleUpdateException);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
