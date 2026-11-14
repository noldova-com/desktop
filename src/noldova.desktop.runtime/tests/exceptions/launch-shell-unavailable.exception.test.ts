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
import { LaunchException, LaunchShellUnavailableException } from "@noldova/desktop.runtime";

@TestClass
export class LaunchShellUnavailableExceptionTests {
  @TestMethod
  public keepsItsFactsAndFormatsItsMessage(): void {
    const cause = new Error("ENOENT");

    const exception = new LaunchShellUnavailableException(new ExceptionOptions(cause));

    Assert.areEqual("Starting a program on Linux requires executable Bash at /bin/bash. Install Bash or restore its execute permissions.", exception.message);
    Assert.areEqual(cause, exception.cause);
    Assert.isTrue(exception instanceof LaunchException);
    Assert.areEqual("LaunchShellUnavailableException", exception.name);
  }
}
