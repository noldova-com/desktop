/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  AppImageFolderUnwritableException, AppImageLeftoverNotRemovedException, AppImageNotReplacedException, AppImageUnreadableException, ElectronException, InstallerNotCopiedException,
  InstallerNotHeldException, InstallerNotStartedException, InstallerUnsignedException, NotAnAppImageException, RestartArgumentsNotWrittenException, ShipItNotFoundException,
  ShipItNotRemovedException, ShipItUnreadableException, UpdateChangedBeforeHandoffException, UpdateHandoffException, UpdateNoLongerOfferedException, UpdateNotStagedException,
  UpdateNotStagedInTimeException
} from "@noldova/desktop.electron";

@TestClass
export class UpdateHandoffExceptionTests {
  @TestMethod
  public isTheCategoryOfEachOfItsConditions(): void {
    const exceptions: readonly UpdateHandoffException[] = [
      new NotAnAppImageException(),
      new AppImageUnreadableException("/opt/Sample.AppImage", new Error("EACCES: permission denied")),
      new AppImageFolderUnwritableException("/opt", new Error("EACCES: permission denied")),
      new AppImageLeftoverNotRemovedException("/opt"),
      new AppImageNotReplacedException("/opt/Sample.AppImage", new Error("EACCES: permission denied")),
      new InstallerNotHeldException(32),
      new InstallerNotCopiedException(),
      new InstallerUnsignedException("/tmp/setup.exe", "the signature is not trusted"),
      new InstallerNotStartedException("/tmp/setup.exe", new Error("EACCES: permission denied")),
      new RestartArgumentsNotWrittenException(),
      new ShipItNotFoundException(),
      new ShipItNotRemovedException("launchctl exited with 3"),
      new ShipItUnreadableException("launchctl exited with 3"),
      new UpdateNotStagedException(),
      new UpdateNotStagedInTimeException(),
      new UpdateChangedBeforeHandoffException(),
      new UpdateNoLongerOfferedException("1.3.0")
    ];

    for (const exception of exceptions) {
      Assert.isInstanceOf(exception, UpdateHandoffException);
      Assert.isInstanceOf(exception, ElectronException);
    }
  }
}
