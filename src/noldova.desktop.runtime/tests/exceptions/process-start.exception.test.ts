/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  BatchArgumentRefusedException,
  BatchSystemRootMissingException,
  ModuleStoppingException,
  ProcessStartException,
  ProcessStartFailedException,
  ProgramNotFoundException,
  ProgramPathRelativeException,
  PseudoTerminalBatchRefusedException,
  PseudoTerminalCommandLineBatchRefusedException,
  PseudoTerminalCommandLineRefusedException,
  PseudoTerminalCommandLineWithArgumentsException,
  PseudoTerminalsUndeclaredException,
  UpdatePreparingException,
  VerbatimBatchRefusedException
} from "@noldova/desktop.runtime";

@TestClass
export class ProcessStartExceptionTests {
  @TestMethod
  public isTheCategoryOfItsConditions(): void {
    const exceptions: readonly Error[] = [
      new ProgramNotFoundException("git"),
      new ProgramPathRelativeException("bin/tool"),
      new ProcessStartFailedException("/usr/bin/git"),
      new ModuleStoppingException("notes", "git"),
      new UpdatePreparingException("notes", "git"),
      new PseudoTerminalsUndeclaredException("terminal", "bash"),
      new BatchSystemRootMissingException(),
      new BatchArgumentRefusedException("C:/tools/build.cmd"),
      new VerbatimBatchRefusedException("C:/tools/build.cmd"),
      new PseudoTerminalCommandLineRefusedException("bash"),
      new PseudoTerminalCommandLineWithArgumentsException("cmd.exe"),
      new PseudoTerminalCommandLineBatchRefusedException("C:/tools/build.cmd"),
      new PseudoTerminalBatchRefusedException("C:/tools/build.cmd")
    ];

    for (const exception of exceptions)
      Assert.isTrue(exception instanceof ProcessStartException, exception.name);
  }
}
