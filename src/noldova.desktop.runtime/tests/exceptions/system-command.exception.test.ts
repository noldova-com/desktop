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
  CommandFailedException,
  ExitCodeUnreadableException,
  ExitWaitTimedOutException,
  FolderNotPrivateException,
  ForegroundGroupReadFailedException,
  ForegroundGroupUnreadableException,
  JobAssignmentFailedException,
  JobClosedBeforeExitException,
  NoJobForExitCodeException,
  ProcessTableRowUnreadableException,
  SystemCommandException,
  SystemRootMissingException,
  UserIdentityUnreadableException
} from "@noldova/desktop.runtime";

@TestClass
export class SystemCommandExceptionTests {
  @TestMethod
  public isTheCategoryOfItsConditions(): void {
    const exceptions: readonly Error[] = [
      new CommandFailedException("icacls.exe", new Error("Command failed: icacls.exe")),
      new SystemRootMissingException(),
      new UserIdentityUnreadableException("USER INFORMATION"),
      new FolderNotPrivateException("/home/person/.noldova", "drwxr-xr-x"),
      new ForegroundGroupUnreadableException(812, "812 (bash) S"),
      new ForegroundGroupReadFailedException(812, new Error("EACCES")),
      new ProcessTableRowUnreadableException("77 (node"),
      new JobAssignmentFailedException(4100, 5),
      new NoJobForExitCodeException(4100),
      new JobClosedBeforeExitException(4100),
      new ExitWaitTimedOutException(4100, 2000),
      new ExitCodeUnreadableException(4100)
    ];

    for (const exception of exceptions)
      Assert.isTrue(exception instanceof SystemCommandException, exception.name);
  }
}
