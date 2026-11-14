/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppImageFolderUnwritableException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class AppImageFolderUnwritableExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const folder = "/opt";
    const cause = new Error("EACCES: permission denied");

    const failure = new AppImageFolderUnwritableException(folder, cause);

    Assert.areEqual("The folder /opt cannot be written, so the AppImage in it cannot be replaced with the update: Error: EACCES: permission denied", failure.message);
    Assert.areEqual(folder, failure.folder);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("AppImageFolderUnwritableException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
