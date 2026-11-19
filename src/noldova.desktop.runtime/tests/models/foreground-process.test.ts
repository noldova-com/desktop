/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ForegroundProcess } from "@noldova/desktop.runtime";

@TestClass
export class ForegroundProcessTests {
  @TestMethod
  public runsTheTerminalsProgramOnlyWhileItsLeadersProgramIsTheTerminalsOwn(): void {
    const copy = new ForegroundProcess(4_188, "/usr/bin/bash", "/usr/bin/bash");
    const started = new ForegroundProcess(4_188, "/usr/bin/sleep", "/usr/bin/bash");
    const exited = new ForegroundProcess(4_188, null, "/usr/bin/bash");

    Assert.isTrue(copy.isTerminalProgram);
    Assert.isFalse(started.isTerminalProgram);
    Assert.isFalse(exited.isTerminalProgram);
    Assert.areEqual("4188 /usr/bin/sleep /usr/bin/bash", `${started.group} ${started.program} ${started.terminalProgram}`);
  }
}
