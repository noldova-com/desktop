/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShipItNotRemovedException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class ShipItNotRemovedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = "launchctl exited with 3";

    const failure = new ShipItNotRemovedException(cause);

    Assert.areEqual("The staged update could not be withdrawn, so it may install when Noldova Desktop Sample quits: launchctl exited with 3", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("ShipItNotRemovedException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
