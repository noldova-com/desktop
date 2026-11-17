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
  public buildsInItsSourceRepositoryUnlessAnotherIsNamed(): void {
    const request = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_SOURCE_REPOSITORY: "example/sample-app", RELEASE_BUILD_REPOSITORY: "" });
    const same = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_BUILD_REPOSITORY: "Example/Sample-App" });
    const built = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_REPOSITORY: "example/downloads", RELEASE_SOURCE_REPOSITORY: "example/sample-app", RELEASE_BUILD_REPOSITORY: "example/builds", RELEASE_TAG_PREFIX: "sample-app-" });
    const apart = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_BUILD_REPOSITORY: "example/builds" });

    Assert.areEqual("example/sample-app,false,false", [request.buildRepository, request.isBuiltElsewhere, same.isBuiltElsewhere].join());
    Assert.areEqual("example/builds,example/sample-app,true,true", [built.buildRepository, built.sourceRepository, built.isBuiltElsewhere, built.isSeparate].join());
    Assert.areEqual("false,true,true", [request.isBuiltApart, built.isBuiltApart, apart.isBuiltApart].join());
  }

  @TestMethod
  public publishesInAnotherRepositoryUnderItsOwnTagPrefix(): void {
    const request = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_REPOSITORY: "example/downloads", RELEASE_SOURCE_REPOSITORY: "example/sample-app", RELEASE_TAG_PREFIX: "sample-app-" });

    Assert.areEqual("example/downloads,example/sample-app,sample-app-1.2.3,true", [request.repository, request.sourceRepository, request.tag, request.isSeparate].join());
    Assert.areEqual("true,false,false", [request.ownsTag("sample-app-0.0.1"), request.ownsTag("other-app-0.0.1"), request.ownsTag("v0.0.1")].join());
  }

  @TestMethod
  public readsTheVersionAtTheEndOfAHyphenatedAppsTagAndLeavesALongerAppsTags(): void {
    const hyphenated = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_REPOSITORY: "example/downloads", RELEASE_TAG_PREFIX: "sample-tool-" });
    const shorter = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_REPOSITORY: "example/downloads", RELEASE_TAG_PREFIX: "sample-" });

    Assert.areEqual("sample-tool-1.2.3,1.0.0", [hyphenated.tag, hyphenated.parseTag("sample-tool-1.0.0", "The latest release").text].join());
    Assert.areEqual("true,false,true,false", [hyphenated.ownsTag("sample-tool-1.0.0"), shorter.ownsTag("sample-tool-1.0.0"), shorter.ownsTag("sample-2.0.0"), hyphenated.ownsTag("sample-tool-next")].join());
  }

  @TestMethod
  public readsATagUnderItsPrefixAndRefusesAnyOther(): void {
    const request = ReleaseRequest.read(ReleaseRequestTests.REQUEST);
    const prefixed = ReleaseRequest.read({ ...ReleaseRequestTests.REQUEST, RELEASE_TAG_PREFIX: "sample-app-" });

    Assert.areEqual("0.0.2,0.0.3", [request.parseTag("v0.0.2", "The latest release").text, prefixed.parseTag("sample-app-0.0.3", "The latest release").text].join());
    Assert.areEqual("The latest release must be a tag such as v0.0.2, not \"0.0.2\".", Assert.throws(() => request.parseTag("0.0.2", "The latest release"), BuildException).message);
    Assert.areEqual("The latest release must be a plain version such as 0.0.2, not \"next\".", Assert.throws(() => request.parseTag("vnext", "The latest release"), BuildException).message);
    Assert.areEqual("The latest release must be a tag such as sample-app-0.0.2, not \"v0.0.2\".",
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
      [{ RELEASE_BUILD_REPOSITORY: "builds" }, "RELEASE_BUILD_REPOSITORY must name a repository as owner/name, not \"builds\"."],
      [{ RELEASE_BUILD_REPOSITORY: "example/builds/app" }, "RELEASE_BUILD_REPOSITORY must name a repository as owner/name, not \"example/builds/app\"."],
      [{ RELEASE_TAG_PREFIX: "sample-app" }, "RELEASE_TAG_PREFIX must be v, or lowercase words joined by dashes and ending in a dash, such as app-, not \"sample-app\"."],
      [{ RELEASE_TAG_PREFIX: "Sample-" }, "RELEASE_TAG_PREFIX must be v, or lowercase words joined by dashes and ending in a dash, such as app-, not \"Sample-\"."],
      [{ RELEASE_TAG_PREFIX: "sample--app-" }, "RELEASE_TAG_PREFIX must be v, or lowercase words joined by dashes and ending in a dash, such as app-, not \"sample--app-\"."],
      [{ RELEASE_REPOSITORY: "example/downloads", RELEASE_SOURCE_REPOSITORY: "example/sample-app" },
        "RELEASE_TAG_PREFIX must name the app, such as app-, for a release in example/downloads, which isn't its source repository example/sample-app: a v tag there can't say which app it belongs to."],
      [{ RELEASE_REPOSITORY: "example/downloads", RELEASE_SOURCE_REPOSITORY: "example/sample-app", RELEASE_TAG_PREFIX: "v" },
        "RELEASE_TAG_PREFIX must name the app, such as app-, for a release in example/downloads, which isn't its source repository example/sample-app: a v tag there can't say which app it belongs to."],
      [{ RELEASE_TAG_PREFIX: "-" }, "RELEASE_TAG_PREFIX must be v, or lowercase words joined by dashes and ending in a dash, such as app-, not \"-\"."]
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
