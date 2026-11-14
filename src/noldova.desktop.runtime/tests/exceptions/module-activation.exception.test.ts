/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ModuleActivationException } from "@noldova/desktop.runtime";

@TestClass
export class ModuleActivationExceptionTests {
  @TestMethod
  public keepsTheMessageAndTheCause(): void {
    const cause = new Error("The backend is missing.");
    const exception = new ModuleActivationException("It runs on Windows and macOS.", { cause });

    Assert.areEqual("It runs on Windows and macOS.", exception.message);
    Assert.areEqual("ModuleActivationException", exception.name);
    Assert.areEqual(cause, exception.cause);
  }

  @TestMethod
  public refusesABlankMessage(): void {
    const exception = Assert.throws(() => new ModuleActivationException(" "), ArgumentException);

    Assert.areEqual("message", exception.parameterName);
  }
}
