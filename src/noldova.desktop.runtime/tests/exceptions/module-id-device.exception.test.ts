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
import { DeclarationsFormatException, ModuleIdDeviceException } from "@noldova/desktop.runtime";

@TestClass
export class ModuleIdDeviceExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const cause = new Error("The store is closed.");

    const exception = new ModuleIdDeviceException("con", new ExceptionOptions(cause));

    Assert.areEqual("The module id \"con\" names a device on Windows, so it is refused on every platform.", exception.message);
    Assert.areEqual("con", exception.moduleId);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, DeclarationsFormatException);
    Assert.areEqual("ModuleIdDeviceException", exception.name);
  }
}
