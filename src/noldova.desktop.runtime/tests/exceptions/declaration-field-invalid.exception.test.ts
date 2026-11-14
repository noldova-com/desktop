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
import { DeclarationFieldInvalidException, DeclarationsFormatException } from "@noldova/desktop.runtime";

@TestClass
export class DeclarationFieldInvalidExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new DeclarationFieldInvalidException("version", new ExceptionOptions(cause));

    Assert.areEqual("A module declaration's version is missing or invalid.", exception.message);
    Assert.areEqual("version", exception.field);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, DeclarationsFormatException);
    Assert.areEqual("DeclarationFieldInvalidException", exception.name);
  }
}
