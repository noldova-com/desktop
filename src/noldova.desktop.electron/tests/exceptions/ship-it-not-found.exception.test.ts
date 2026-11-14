/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ShipItNotFoundException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class ShipItNotFoundExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new ShipItNotFoundException();

    Assert.areEqual("macOS prepared the update, but nothing is waiting to install it.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("ShipItNotFoundException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
