/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { RuntimeException } from "@noldova/desktop.runtime";

import { EnvironmentUnreadableException } from "../../src/exceptions/environment-unreadable.exception.js";

@TestClass
export class EnvironmentUnreadableExceptionTests {
  @TestMethod
  public saysThatPowerShellWroteNoVariables(): void {
    const exception = new EnvironmentUnreadableException();

    Assert.areEqual("Windows PowerShell did not write the machine's and the person's variables as text.", exception.message);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof RuntimeException);
    Assert.areEqual("EnvironmentUnreadableException", exception.name);
  }
}
