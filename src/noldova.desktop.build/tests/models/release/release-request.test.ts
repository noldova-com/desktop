/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ReleaseRequest } from "../../../src/models/release/release-request.js";

@TestClass
export class ReleaseRequestTests {
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly REQUEST: Readonly<Record<string, string>> = { RELEASE_REPOSITORY: "example/sample-app", RELEASE_VERSION: "1.2.3", RELEASE_REVISION: ReleaseRequestTests.REVISION };

  @TestMethod
  public readsTheRepositoryVersionAndRevision(): void {
    const request = ReleaseRequest.read(ReleaseRequestTests.REQUEST);

    Assert.areEqual(`example/sample-app,1.2.3,${ReleaseRequestTests.REVISION}`, [request.repository, request.version.text, request.revision].join());
  }

  @TestMethod
  public refusesARepositoryVersionOrRevisionItCannotUse(): void {
    const cases: readonly (readonly [Readonly<Record<string, string>>, string])[] = [
      [{ RELEASE_REPOSITORY: "sample-app" }, "RELEASE_REPOSITORY must name a repository as owner/name, not \"sample-app\"."],
      [{ RELEASE_REPOSITORY: "example/.." }, "RELEASE_REPOSITORY must name a repository as owner/name, not \"example/..\"."],
      [{ RELEASE_VERSION: "1.2" }, "RELEASE_VERSION must be a plain version such as 0.0.2, not \"1.2\"."],
      [{ RELEASE_REVISION: "0123456" }, "RELEASE_REVISION must be a full commit SHA of 40 lowercase hexadecimal digits, not \"0123456\"."]
    ];

    for (const [fields, message] of cases)
      Assert.areEqual(message, Assert.throws(() => ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, ...fields }), BuildException).message);
  }

  @TestMethod
  public refusesARequestThatSetsNothing(): void {
    const error = Assert.throws(() => ReleaseRequest.read({}), BuildException);

    Assert.areEqual("RELEASE_REPOSITORY must name a repository as owner/name, not \"\".", error.message);
    Assert.areEqual("RELEASE_VERSION must be a plain version such as 0.0.2, not \"\".",
      Assert.throws(() => ReleaseRequest.read({ RELEASE_REPOSITORY: "example/sample-app" }), BuildException).message);
    Assert.areEqual("RELEASE_REVISION must be a full commit SHA of 40 lowercase hexadecimal digits, not \"\".",
      Assert.throws(() => ReleaseRequest.read({ RELEASE_REPOSITORY: "example/sample-app", RELEASE_VERSION: "1.2.3" }), BuildException).message);
  }
}
