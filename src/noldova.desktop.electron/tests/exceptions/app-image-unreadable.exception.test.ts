/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppImageUnreadableException, UpdateHandoffException } from "@noldova/desktop.electron";

@TestClass
export class AppImageUnreadableExceptionTests {
  @TestMethod
  public formatsItsMessageAndKeepsItsFactsAndCause(): void {
    const image = "/opt/Sample.AppImage";
    const cause = new Error("EACCES: permission denied");

    const failure = new AppImageUnreadableException(image, cause);

    Assert.areEqual("The AppImage /opt/Sample.AppImage could not be read, so the update was not installed: Error: EACCES: permission denied", failure.message);
    Assert.areEqual(image, failure.image);
    Assert.areEqual<unknown>(cause, failure.cause);
    Assert.areEqual("AppImageUnreadableException", failure.name);
    Assert.isInstanceOf(failure, UpdateHandoffException);
  }
}
