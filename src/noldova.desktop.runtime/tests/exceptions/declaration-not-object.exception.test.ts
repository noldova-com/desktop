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
import { DeclarationNotObjectException, DeclarationsFormatException } from "@noldova/desktop.runtime";

@TestClass
export class DeclarationNotObjectExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new DeclarationNotObjectException(new ExceptionOptions(cause));

    Assert.areEqual("A module declaration is not a JSON object.", exception.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, DeclarationsFormatException);
    Assert.areEqual("DeclarationNotObjectException", exception.name);
  }
}
