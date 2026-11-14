/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DeclarationsFormatException, DeclarationsUnreadableException } from "@noldova/desktop.runtime";

@TestClass
export class DeclarationsUnreadableExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new SyntaxError("Unexpected token");

    const exception = new DeclarationsUnreadableException("/app/modules.json", cause);

    Assert.areEqual("The module declarations /app/modules.json are not valid: SyntaxError: Unexpected token", exception.message);
    Assert.areEqual("/app/modules.json", exception.file);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, DeclarationsFormatException);
    Assert.areEqual("DeclarationsUnreadableException", exception.name);
  }
}
