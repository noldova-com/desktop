/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { NotAnAppImageException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class NotAnAppImageExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const failure = new NotAnAppImageException();

    Assert.areEqual("This copy of Noldova Desktop Sample doesn't run from an AppImage, so it can't install the update.", failure.message);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("NotAnAppImageException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
