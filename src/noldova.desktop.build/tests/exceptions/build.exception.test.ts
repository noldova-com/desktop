/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../src/exceptions/build.exception.js";
import { GitHubRequestException } from "../../src/exceptions/github-request.exception.js";
import { ProcessTimeoutException } from "../../src/exceptions/process-timeout.exception.js";

@TestClass
export class BuildExceptionTests {
  @TestMethod
  public carriesItsNameTheMessageAndTheCause(): void {
    const cause = new Error("cause");

    const exception = new BuildException("It failed.", new ExceptionOptions(cause));

    Assert.areEqual("BuildException", exception.name);
    Assert.areEqual("It failed.", exception.message);
    Assert.areEqual<unknown>(cause, exception.cause);
    Assert.isInstanceOf(exception, Exception);
  }

  @TestMethod
  public hasNoCauseWithoutOne(): void {
    Assert.isUndefined(new BuildException("It failed.").cause);
  }

  @TestMethod
  public isTheBaseOfEveryExceptionThePackageOwns(): void {
    const exceptions = [new GitHubRequestException(["api", "user"], 1, "gh: Not Found (HTTP 404)", 404), new ProcessTimeoutException("npm", 1)];

    for (const exception of exceptions)
      Assert.isInstanceOf(exception, BuildException);
  }
}
