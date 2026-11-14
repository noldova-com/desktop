/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  DatabasesNotBackedUpException, ElectronException, ProcessesNotExitedException, UpdateHolderNotFoundException, UpdateRefusedException, UpdateRuntimeNotFoundException,
  UpdateRuntimeNotReachedException, UpdateRuntimeStillStartingException, UpdateStopException, UpdateStopFailedUnexpectedlyException, UpdateUnderWayException, UpdateUnsavedException,
  WorkStartedMeanwhileException
} from "@noldova/desktop.electron";
import { Failure, FailureCode, UpdateProcess } from "@noldova/desktop.protocol";

@TestClass
export class UpdateStopExceptionTests {
  @TestMethod
  public isTheCategoryOfEachOfItsConditions(): void {
    const exceptions: readonly UpdateStopException[] = [
      new UpdateUnderWayException(),
      new UpdateHolderNotFoundException(),
      new WorkStartedMeanwhileException(["Saving notes (/data)", "Export (/data)"]),
      new UpdateRuntimeNotFoundException("/data"),
      new UpdateRuntimeNotReachedException("/data"),
      new UpdateRuntimeStillStartingException("/data"),
      new UpdateRefusedException("/data", new Failure(FailureCode.Conflict, "Work is running.")),
      new UpdateUnsavedException("/data", ["notes.md", "todo.md"]),
      new DatabasesNotBackedUpException("/data", new Error("ENOSPC: no space left on device")),
      new ProcessesNotExitedException([new UpdateProcess(4120, 1500, 1501, "runtime"), new UpdateProcess(4121, 1500, 1501, "main")], 15_000),
      new UpdateStopFailedUnexpectedlyException()
    ];

    for (const exception of exceptions) {
      Assert.isInstanceOf(exception, UpdateStopException);
      Assert.isInstanceOf(exception, ElectronException);
    }
  }
}
