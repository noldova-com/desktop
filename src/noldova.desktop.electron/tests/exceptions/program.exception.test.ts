/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProgramException } from "@noldova/desktop.electron";

@TestClass
export class ProgramExceptionTests {
  @TestMethod
  public namesTheProgramAndKeepsTheCause(): void {
    const cause = new Error("spawn /usr/bin/gdbus ENOENT");

    const failure = new ProgramException("/usr/bin/gdbus", cause);

    Assert.areEqual("/usr/bin/gdbus failed: spawn /usr/bin/gdbus ENOENT", failure.message);
    Assert.areEqual("/usr/bin/gdbus", failure.file);
    Assert.areEqual(cause, failure.cause);
    Assert.areEqual("ProgramException", failure.name);
    Assert.isInstanceOf(failure, Exception);
  }
}
