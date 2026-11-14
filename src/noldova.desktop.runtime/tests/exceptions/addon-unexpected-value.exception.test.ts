/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AddonLoadException, AddonUnexpectedValueException } from "@noldova/desktop.runtime";

@TestClass
export class AddonUnexpectedValueExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new AddonUnexpectedValueException("darwin-arm64/posix-process.node");

    Assert.areEqual("The runtime's addon native/darwin-arm64/posix-process.node returned a value this runtime does not expect; it comes from another build.", exception.message);
    Assert.areEqual("darwin-arm64/posix-process.node", exception.addon);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof AddonLoadException);
    Assert.areEqual("AddonUnexpectedValueException", exception.name);
  }
}
