/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode } from "@noldova/desktop.protocol";
import {
  AppImageCopyUnavailableException,
  AppImageCopyUnlistedException,
  LaunchDescriptorsUnavailableException,
  LaunchException,
  LaunchLimitReachedException,
  LaunchShellUnavailableException,
  LaunchStartFailedException,
  LaunchTimedOutException,
  MainProcessRefusedAgainException,
  MoveAsideRefusedException,
  RuntimeExitedException,
  RuntimeExitedWithoutReasonException,
  StopRefusedException,
  StopTimedOutException
} from "@noldova/desktop.runtime";

@TestClass
export class LaunchExceptionTests {
  @TestMethod
  public isTheCategoryOfItsConditions(): void {
    const exceptions: readonly Error[] = [
      new LaunchShellUnavailableException(),
      new LaunchDescriptorsUnavailableException(),
      new LaunchStartFailedException("/opt/sample/sample"),
      new AppImageCopyUnavailableException("/home/person/Sample.AppImage"),
      new AppImageCopyUnlistedException(4242),
      new MoveAsideRefusedException(new Failure(FailureCode.Conflict, "The backups folder is in use.")),
      new MainProcessRefusedAgainException(),
      new LaunchTimedOutException(),
      new LaunchLimitReachedException(120000),
      new RuntimeExitedException("The data directory is read-only."),
      new RuntimeExitedWithoutReasonException(),
      new StopRefusedException(new Failure(FailureCode.Unavailable, "The runtime is stopping already.")),
      new StopTimedOutException()
    ];

    for (const exception of exceptions)
      Assert.isTrue(exception instanceof LaunchException, exception.name);
  }
}
