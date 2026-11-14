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
import { LaunchDescriptorsUnavailableException, LaunchException } from "@noldova/desktop.runtime";

@TestClass
export class LaunchDescriptorsUnavailableExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const cause = new Error("ENOENT");

    const exception = new LaunchDescriptorsUnavailableException(new ExceptionOptions(cause));

    Assert.areEqual("Starting a program on Linux requires access to /proc/self/fd. Ensure procfs is mounted at /proc and this process can read and traverse its descriptor directory.", exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("LaunchDescriptorsUnavailableException", exception.name);
  }
}
