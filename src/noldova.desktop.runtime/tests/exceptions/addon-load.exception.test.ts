/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  AddonIncompleteException,
  AddonLoadException,
  AddonLoadFailedException,
  AddonMissingException,
  AddonUnexpectedValueException
} from "@noldova/desktop.runtime";

@TestClass
export class AddonLoadExceptionTests {
  @TestMethod
  public isTheCategoryOfItsConditions(): void {
    const exceptions: readonly Error[] = [
      new AddonMissingException("linux-riscv64", "posix-process.node"),
      new AddonLoadFailedException("linux-x64/posix-process.node"),
      new AddonIncompleteException("win32-x64/windows-process.node"),
      new AddonUnexpectedValueException("darwin-arm64/posix-process.node")
    ];

    for (const exception of exceptions)
      Assert.isTrue(exception instanceof AddonLoadException, exception.name);
  }
}
