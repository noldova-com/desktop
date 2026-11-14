/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  ElectronException, UpdateCheckerUnknownException, UpdateDownloadInterruptedException, UpdateDownloadMismatchException, UpdateException, UpdateFailedUnexpectedlyException,
  UpdateFeedRedirectedException, UpdateFeedRefusedException, UpdateFeedUnreachableException, UpdateInfoInvalidException, UpdateNotSignedException
} from "@noldova/desktop.electron";

@TestClass
export class UpdateExceptionTests {
  @TestMethod
  public isTheCategoryOfEachOfItsConditions(): void {
    const exceptions: readonly UpdateException[] = [
      new UpdateFeedRefusedException(404),
      new UpdateFeedRedirectedException(),
      new UpdateFeedUnreachableException(),
      new UpdateInfoInvalidException(),
      new UpdateDownloadInterruptedException(),
      new UpdateDownloadMismatchException(),
      new UpdateNotSignedException(),
      new UpdateCheckerUnknownException(),
      new UpdateFailedUnexpectedlyException()
    ];

    for (const exception of exceptions) {
      Assert.isInstanceOf(exception, UpdateException);
      Assert.isInstanceOf(exception, ElectronException);
    }
  }
}
