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
import { AddonLoadException, AddonLoadFailedException } from "@noldova/desktop.runtime";

@TestClass
export class AddonLoadFailedExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const cause = new Error("ENOENT");

    const exception = new AddonLoadFailedException("linux-x64/posix-process.node", new ExceptionOptions(cause));

    Assert.areEqual("The runtime could not load its addon native/linux-x64/posix-process.node.", exception.message);
    Assert.areEqual("linux-x64/posix-process.node", exception.addon);
    Assert.areEqual(cause, exception.cause);
    Assert.isTrue(exception instanceof AddonLoadException);
    Assert.areEqual("AddonLoadFailedException", exception.name);
  }
}
