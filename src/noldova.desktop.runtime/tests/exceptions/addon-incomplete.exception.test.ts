/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AddonIncompleteException, AddonLoadException } from "@noldova/desktop.runtime";

@TestClass
export class AddonIncompleteExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new AddonIncompleteException("win32-x64/windows-process.node");

    Assert.areEqual("The runtime's addon native/win32-x64/windows-process.node lacks functions this runtime calls; it comes from another build.", exception.message);
    Assert.areEqual("win32-x64/windows-process.node", exception.addon);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof AddonLoadException);
    Assert.areEqual("AddonIncompleteException", exception.name);
  }
}
