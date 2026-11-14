/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AppImageCopyUnlistedException, LaunchException } from "@noldova/desktop.runtime";

@TestClass
export class AppImageCopyUnlistedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new AppImageCopyUnlistedException(4242);

    Assert.areEqual("The process table does not list process 4242, so the runtime's AppImage copy cannot be recorded.", exception.message);
    Assert.areEqual(4242, exception.processId);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("AppImageCopyUnlistedException", exception.name);
  }
}
