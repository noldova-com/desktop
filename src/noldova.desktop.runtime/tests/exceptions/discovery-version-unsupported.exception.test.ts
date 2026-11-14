/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DiscoveryFormatException, DiscoveryVersionUnsupportedException } from "@noldova/desktop.runtime";

@TestClass
export class DiscoveryVersionUnsupportedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new DiscoveryVersionUnsupportedException(2, new ExceptionOptions(cause));

    Assert.areEqual("The discovery metadata has the unsupported format version 2.", exception.message);
    Assert.areEqual<unknown>(2, exception.version);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, DiscoveryFormatException);
    Assert.areEqual("DiscoveryVersionUnsupportedException", exception.name);
  }
}
