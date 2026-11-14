/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AddonLoadException, AddonMissingException } from "@noldova/desktop.runtime";

@TestClass
export class AddonMissingExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const exception = new AddonMissingException("linux-riscv64", "posix-process.node");

    Assert.areEqual("The runtime has no linux-riscv64 build of its addon posix-process.node: native/linux-riscv64/posix-process.node is missing.", exception.message);
    Assert.areEqual("linux-riscv64", exception.target);
    Assert.areEqual("posix-process.node", exception.file);
    Assert.isUndefined(exception.cause);
    Assert.isTrue(exception instanceof AddonLoadException);
    Assert.areEqual("AddonMissingException", exception.name);
  }
}
