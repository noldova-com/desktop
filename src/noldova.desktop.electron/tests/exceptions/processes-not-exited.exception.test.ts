/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessesNotExitedException, UpdateStopException } from "@noldova/desktop.electron";
import { UpdateProcess } from "@noldova/desktop.protocol";

@TestClass
export class ProcessesNotExitedExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const processes = [new UpdateProcess(4120, 1500, 1501, "runtime"), new UpdateProcess(4121, 1500, 1501, "main")];
    const milliseconds = 15_000;

    const failure = new ProcessesNotExitedException(processes, milliseconds);

    Assert.areEqual("These processes did not exit within 15 seconds: runtime 4120; main 4121", failure.message);
    Assert.areEqual(processes, failure.processes);
    Assert.areEqual(milliseconds, failure.milliseconds);
    Assert.isUndefined(failure.cause);
    Assert.areEqual("ProcessesNotExitedException", failure.name);
    Assert.isInstanceOf(failure, UpdateStopException);
  }
}
