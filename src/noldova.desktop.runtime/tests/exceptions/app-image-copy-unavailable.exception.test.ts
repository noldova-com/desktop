/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppImageCopyUnavailableException, LaunchException } from "@noldova/desktop.runtime";

@TestClass
export class AppImageCopyUnavailableExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const cause = new Error("ENOENT");

    const exception = new AppImageCopyUnavailableException("/home/person/Sample.AppImage", new ExceptionOptions(cause));

    Assert.areEqual("/home/person/Sample.AppImage could be neither mounted nor extracted, so the runtime cannot start.", exception.message);
    Assert.areEqual("/home/person/Sample.AppImage", exception.image);
    Assert.areEqual(cause, exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("AppImageCopyUnavailableException", exception.name);
  }
}
