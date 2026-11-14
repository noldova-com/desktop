/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { SystemCommandException, SystemRootMissingException } from "@noldova/desktop.runtime";

@TestClass
export class SystemRootMissingExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new SystemRootMissingException();

    Assert.areEqual("SystemRoot is not set, so the Windows system tools cannot be found.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("SystemRootMissingException", exception.name);
  }
}
