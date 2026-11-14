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
import { DiscoveryFieldInvalidException, DiscoveryFormatException } from "@noldova/desktop.runtime";

@TestClass
export class DiscoveryFieldInvalidExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new DiscoveryFieldInvalidException("token", new ExceptionOptions(cause));

    Assert.areEqual("The discovery metadata's token is missing or invalid.", exception.message);
    Assert.areEqual("token", exception.field);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, DiscoveryFormatException);
    Assert.areEqual("DiscoveryFieldInvalidException", exception.name);
  }
}
