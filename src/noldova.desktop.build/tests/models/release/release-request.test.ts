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
  public publishesFromItsOwnRepositoryAsVAndAVersionWhenNoSourceOrPrefixIsSet(): void {
    const request = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_SOURCE_REPOSITORY: "", RELEASE_TAG_PREFIX: "" });
    const same = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_SOURCE_REPOSITORY: "Example/Sample-App" });

    Assert.areEqual("example/sample-app,v1.2.3,false,false", [request.sourceRepository, request.tag, request.isSeparate, same.isSeparate].join());
  }

  @TestMethod
  public publishesInAnotherRepositoryUnderItsOwnTagPrefix(): void {
    const request = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_REPOSITORY: "example/downloads", RELEASE_SOURCE_REPOSITORY: "example/sample-app", RELEASE_TAG_PREFIX: "sample-app-v" });

    Assert.areEqual("example/downloads,example/sample-app,sample-app-v1.2.3,true", [request.repository, request.sourceRepository, request.tag, request.isSeparate].join());
    Assert.areEqual("true,false,false", [request.ownsTag("sample-app-v0.0.1"), request.ownsTag("other-app-v0.0.1"), request.ownsTag("v0.0.1")].join());
  }

  @TestMethod
  public readsATagUnderItsPrefixAndRefusesAnyOther(): void {
    const request = ReleaseRequest.read(ReleaseRequestTests.REQUEST);
    const prefixed = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_TAG_PREFIX: "sample-app-v" });

    Assert.areEqual("0.0.2,0.0.3", [request.parseTag("v0.0.2", "The latest release").text, prefixed.parseTag("sample-app-v0.0.3", "The latest release").text].join());
    Assert.areEqual("The latest release must be a tag such as v0.0.2, not \"0.0.2\".", Assert.throws(() => request.parseTag("0.0.2", "The latest release"), BuildException).message);
    Assert.areEqual("The latest release must be a plain version such as 0.0.2, not \"next\".", Assert.throws(() => request.parseTag("vnext", "The latest release"), BuildException).message);
    Assert.areEqual("The latest release must be a tag such as sample-app-v0.0.2, not \"v0.0.2\".",
      Assert.throws(() => prefixed.parseTag("v0.0.2", "The latest release"), BuildException).message);
  }

  @TestMethod
  public refusesARepositoryVersionOrRevisionItCannotUse(): void {
    const cases: readonly (readonly [Readonly<Record<string, string>>, string])[] = [
      [{ RELEASE_REPOSITORY: "sample-app" }, "RELEASE_REPOSITORY must name a repository as owner/name, not \"sample-app\"."],
      [{ RELEASE_REPOSITORY: "example/.." }, "RELEASE_REPOSITORY must name a repository as owner/name, not \"example/..\"."],
      [{ RELEASE_VERSION: "1.2" }, "RELEASE_VERSION must be a plain version such as 0.0.2, not \"1.2\"."],
      [{ RELEASE_REVISION: "0123456" }, "RELEASE_REVISION must be a full commit SHA of 40 lowercase hexadecimal digits, not \"0123456\"."],
      [{ RELEASE_SOURCE_REPOSITORY: "sample-app" }, "RELEASE_SOURCE_REPOSITORY must name a repository as owner/name, not \"sample-app\"."],
      [{ RELEASE_TAG_PREFIX: "sample-app-" }, "RELEASE_TAG_PREFIX must be v, or lowercase words joined by dashes and ending in -v, such as app-v, not \"sample-app-\"."],
      [{ RELEASE_TAG_PREFIX: "Sample-v" }, "RELEASE_TAG_PREFIX must be v, or lowercase words joined by dashes and ending in -v, such as app-v, not \"Sample-v\"."],
      [{ RELEASE_TAG_PREFIX: "-v" }, "RELEASE_TAG_PREFIX must be v, or lowercase words joined by dashes and ending in -v, such as app-v, not \"-v\"."]
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
