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
import { DiscoveryFormatException, DiscoveryNotObjectException } from "@noldova/desktop.runtime";

@TestClass
export class DiscoveryNotObjectExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new DiscoveryNotObjectException(new ExceptionOptions(cause));

    Assert.areEqual("The discovery metadata is not a JSON object.", exception.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, DiscoveryFormatException);
    Assert.areEqual("DiscoveryNotObjectException", exception.name);
  }
}
