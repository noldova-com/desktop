/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShipItUnreadableException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class ShipItUnreadableExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = "launchctl exited with 3";

    const failure = new ShipItUnreadableException(cause);

    Assert.areEqual("The installer process of the staged update could not be looked up: launchctl exited with 3", failure.message);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("ShipItUnreadableException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
