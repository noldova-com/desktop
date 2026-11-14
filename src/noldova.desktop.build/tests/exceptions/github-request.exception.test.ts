/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../src/exceptions/build.exception.js";
import { GitHubRequestException } from "../../src/exceptions/github-request.exception.js";

@TestClass
export class GitHubRequestExceptionTests {
  @TestMethod
  public carriesItsNameTheMessageAndTheFacts(): void {
    const gitHubArguments = ["api", "repos/example/sample-app/releases/1"];

    const exception = new GitHubRequestException(gitHubArguments, 1, "gh: Not Found (HTTP 404)\n", 404);

    Assert.areEqual("GitHubRequestException", exception.name);
    Assert.areEqual("\"gh api repos/example/sample-app/releases/1\" failed with exit code 1: gh: Not Found (HTTP 404)", exception.message);
    Assert.areEqual<unknown>(gitHubArguments, exception.gitHubArguments);
    Assert.areEqual(1, exception.exitCode);
    Assert.areEqual("gh: Not Found (HTTP 404)\n", exception.errorOutput);
    Assert.areEqual(404, exception.status);
    Assert.isUndefined(exception.cause);
    Assert.isInstanceOf(exception, BuildException);
  }

  @TestMethod
  public carriesNoStatusOrExitCodeForAFailureWithoutThem(): void {
    const exception = new GitHubRequestException(["release", "upload"], null, "error connecting to api.github.com", null);

    Assert.areEqual("\"gh release upload\" failed with exit code null: error connecting to api.github.com", exception.message);
    Assert.isNull(exception.exitCode);
    Assert.isNull(exception.status);
  }
}
