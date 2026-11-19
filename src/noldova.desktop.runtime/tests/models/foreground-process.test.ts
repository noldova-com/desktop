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
  public runsTheTerminalsProgramOnlyWhileItsLeaderHasTheTerminalsProgramAndCommandLine(): void {
    const copy = new ForegroundProcess(4_188, "/usr/bin/bash", "/bin/bash -i", "/usr/bin/bash", "/bin/bash -i");
    const script = new ForegroundProcess(4_188, "/usr/bin/bash", "bash x.sh", "/usr/bin/bash", "/bin/bash -i");
    const started = new ForegroundProcess(4_188, "/usr/bin/sleep", "sleep 600", "/usr/bin/bash", "/bin/bash -i");
    const exited = new ForegroundProcess(4_188, null, null, "/usr/bin/bash", "/bin/bash -i");

    Assert.isTrue(copy.isTerminalProgram);
    Assert.isFalse(script.isTerminalProgram);
    Assert.isFalse(started.isTerminalProgram);
    Assert.isFalse(exited.isTerminalProgram);
    Assert.areEqual("4188 /usr/bin/sleep sleep 600 /usr/bin/bash /bin/bash -i",
      `${started.group} ${started.program} ${started.commandLine} ${started.terminalProgram} ${started.terminalCommandLine}`);
  }
}
