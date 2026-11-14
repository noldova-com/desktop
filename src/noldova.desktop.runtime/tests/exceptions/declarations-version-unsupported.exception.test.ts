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
import { DeclarationsFormatException, DeclarationsVersionUnsupportedException } from "@noldova/desktop.runtime";

@TestClass
export class DeclarationsVersionUnsupportedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new DeclarationsVersionUnsupportedException(3, new ExceptionOptions(cause));

    Assert.areEqual("The module declarations have the unsupported format version 3.", exception.message);
    Assert.areEqual<unknown>(3, exception.version);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, DeclarationsFormatException);
    Assert.areEqual("DeclarationsVersionUnsupportedException", exception.name);
  }
}
