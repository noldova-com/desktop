/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  DeviceIdentityException, ElectronException, PathCommandException, ProgramException, UnusableFolderException, UpdateChangedBeforeHandoffException, UpdateDownloadInterruptedException,
  UpdateNotStagedException, UpdateUnderWayException, WindowStateNotConnectedException
} from "@noldova/desktop.electron";

@TestClass
export class ElectronExceptionTests {
  @TestMethod
  public keepsTheMessageAndTheCause(): void {
    const cause = new Error("The disk is full.");

    const exception = new ElectronException("The main process could not finish the request.", new ExceptionOptions(cause));

    Assert.areEqual("The main process could not finish the request.", exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.areEqual("ElectronException", exception.name);
    Assert.isTrue(exception instanceof Exception);
  }

  @TestMethod
  public isTheBaseOfThePackagesExceptions(): void {
    const exceptions: readonly Exception[] = [
      new DeviceIdentityException("device.json"),
      new PathCommandException("noldova-desktop", null),
      new ProgramException("gdbus", new Error("spawn gdbus ENOENT")),
      new UnusableFolderException("data", null),
      new UpdateChangedBeforeHandoffException(),
      new UpdateDownloadInterruptedException(),
      new UpdateNotStagedException(),
      new UpdateUnderWayException(),
      new WindowStateNotConnectedException()
    ];

    for (const exception of exceptions) {
      Assert.isTrue(exception instanceof ElectronException, exception.name);
    }
  }
}
