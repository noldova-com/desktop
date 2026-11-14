/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UsageException } from "@noldova/desktop.cli";

import { ArgumentsTwiceException } from "../../src/exceptions/arguments-twice.exception.js";

@TestClass
export class ArgumentsTwiceExceptionTests {
  @TestMethod
  public saysTheArgumentsCameTwice(): void {
    const exception = new ArgumentsTwiceException();

    Assert.areEqual("The command's arguments were given more than once.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.areEqual("ArgumentsTwiceException", exception.name);
    Assert.isInstanceOf(exception, UsageException);
  }
}
