/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { InstallerNotHeldException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class InstallerNotHeldExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const errorCode = 32;

    const failure = new InstallerNotHeldException(errorCode);

    Assert.areEqual("The update's installer couldn't be held unchanged for its start (Windows error 32).", failure.message);
    Assert.areEqual(errorCode, failure.errorCode);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("InstallerNotHeldException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
