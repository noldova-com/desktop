/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessTableRowUnreadableException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class ProcessTableRowUnreadableExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new ProcessTableRowUnreadableException("77 (node");

    Assert.areEqual("The process table has a row that could not be read: 77 (node", exception.message);
    Assert.areEqual("77 (node", exception.row);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("ProcessTableRowUnreadableException", exception.name);
  }
}
