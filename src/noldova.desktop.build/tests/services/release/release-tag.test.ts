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
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { ReleaseTag } from "../../../src/services/release/release-tag.js";
import { GitHubApi } from "../../../src/services/repository/github-api.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";

@TestClass
export class ReleaseTagTests {
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly OTHER: string = "fedcba9876543210fedcba9876543210fedcba98";

  @TestMethod
  public async readsTheCommitALightweightTagPointsAtAsync(): Promise<void> {
    const commit = await ReleaseTag.readCommitAsync(ReleaseTagTests.api([{ ref: "refs/tags/v1.2.3", object: { type: "commit", sha: ReleaseTagTests.REVISION } }]), "v1.2.3");

    Assert.areEqual(ReleaseTagTests.REVISION, commit);
  }

  @TestMethod
  public async readsNoCommitForATagThatDoesNotExistAsync(): Promise<void> {
    Assert.isNull(await ReleaseTag.readCommitAsync(ReleaseTagTests.api([]), "v1.2.3"));
  }

  @TestMethod
  public async refusesAnAnnotatedTagOrAReferenceOfTheWrongShapeAsync(): Promise<void> {
    const annotated = await Assert.throwsAsync(
      () => ReleaseTag.readCommitAsync(ReleaseTagTests.api([{ ref: "refs/tags/v1.2.3", object: { type: "tag", sha: ReleaseTagTests.REVISION } }]), "v1.2.3"), BuildException);
    const shapeless = await Assert.throwsAsync(() => ReleaseTag.readCommitAsync(ReleaseTagTests.api([{ ref: "refs/tags/v1.2.3", object: "commit" }]), "v1.2.3"), BuildException);

    Assert.areEqual("The tag v1.2.3 is annotated; a release's tag points straight at its commit.", annotated.message);
    Assert.areEqual("the tag v1.2.3.object must be an object.", shapeless.message);
  }

  @TestMethod
  public acceptsATagThatIsMissingOrAtTheRevisionAndRefusesOneElsewhere(): void {
    ReleaseTag.requireAt("v1.2.3", null, ReleaseTagTests.REVISION);
    ReleaseTag.requireAt("v1.2.3", ReleaseTagTests.REVISION, ReleaseTagTests.REVISION);
    const error = Assert.throws(() => ReleaseTag.requireAt("v1.2.3", ReleaseTagTests.OTHER, ReleaseTagTests.REVISION), BuildException);

    Assert.areEqual(`The tag v1.2.3 already points at ${ReleaseTagTests.OTHER}, not at ${ReleaseTagTests.REVISION}; a tag is never moved, so this release needs a new version.`, error.message);
  }

  private static api(references: unknown): GitHubApi {
    return new GitHubApi("example/sample-app", new ScriptedRunnerFixture(() => new ProcessResult(0, JSON.stringify(references), String.empty)), "/work");
  }
}
