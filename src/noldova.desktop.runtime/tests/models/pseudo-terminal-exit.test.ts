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
import { PseudoTerminalExit } from "@noldova/desktop.runtime";

@TestClass
export class PseudoTerminalExitTests {
  @TestMethod
  public isCleanOnlyWhenTheProgramExitedWithCodeZero(): void {
    const clean = new PseudoTerminalExit(0, null);
    const failed = new PseudoTerminalExit(2, null);
    const hungUp = new PseudoTerminalExit(null, "SIGHUP");
    const unknown = new PseudoTerminalExit(null, null);

    Assert.isTrue(clean.isClean);
    Assert.isFalse(failed.isClean);
    Assert.isFalse(hungUp.isClean);
    Assert.isFalse(unknown.isClean);
    Assert.areEqual("2 null", `${failed.code} ${failed.signal}`);
    Assert.areEqual("null SIGHUP", `${hungUp.code} ${hungUp.signal}`);
    Assert.areEqual("null null", `${unknown.code} ${unknown.signal}`);
  }

  @TestMethod
  public refusesAnExitWithBothACodeAndASignal(): void {
    const error = Assert.throws(() => new PseudoTerminalExit(1, "SIGKILL"), ArgumentException);

    Assert.areEqual("code", error.parameterName);
    Assert.areEqual("A pseudo-terminal's exit has an exit code, a signal or neither, not both. (Parameter 'code')", error.message);
  }
}
