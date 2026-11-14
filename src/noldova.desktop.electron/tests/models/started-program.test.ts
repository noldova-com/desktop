/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { StartedProgram } from "@noldova/desktop.electron";

@TestClass
export class StartedProgramTests {
  @TestMethod
  public stopsTheProgramEachTimeItIsAsked(): void {
    let stops = 0;
    const program = new StartedProgram(() => stops++);

    program.stop();
    program.stop();

    Assert.areEqual(2, stops);
  }
}
