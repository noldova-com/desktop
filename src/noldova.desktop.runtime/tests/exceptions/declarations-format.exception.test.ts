/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  DeclarationFieldInvalidException, DeclarationNotObjectException, DeclarationsFormatException, DeclarationsUnreadableException, DeclarationsVersionUnsupportedException, ModuleIdDeviceException,
  RuntimeException
} from "@noldova/desktop.runtime";

@TestClass
export class DeclarationsFormatExceptionTests {
  @TestMethod
  public isTheCategoryOfEachUnreadableDeclaration(): void {
    const exceptions: readonly RuntimeException[] = [
      new DeclarationsUnreadableException("/app/modules.json", new SyntaxError("Unexpected token")),
      new DeclarationsVersionUnsupportedException(3),
      new DeclarationNotObjectException(),
      new DeclarationFieldInvalidException("version"),
      new ModuleIdDeviceException("con")
    ];

    for (const exception of exceptions)
      Assert.isInstanceOf(exception, DeclarationsFormatException, exception.name);
  }
}
