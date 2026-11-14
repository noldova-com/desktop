/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandFailedException, SystemCommandException } from "@noldova/desktop.runtime";

@TestClass
export class CommandFailedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const cause = new Error("Command failed: icacls.exe");

    const exception = new CommandFailedException("icacls.exe", cause);

    Assert.areEqual("icacls.exe failed: Command failed: icacls.exe", exception.message);
    Assert.areEqual("icacls.exe", exception.command);
    Assert.areEqual(cause, exception.cause);
    Assert.isTrue(exception instanceof SystemCommandException);
    Assert.areEqual("CommandFailedException", exception.name);
  }
}
