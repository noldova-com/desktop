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
import { GitHubRequestException } from "../../../src/exceptions/github-request.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { GitHubApi } from "../../../src/services/repository/github-api.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";

@TestClass
export class GitHubApiTests {
  private static readonly REPOSITORY: string = "example/sample-app";

  @TestMethod
  public async readsAResourceOfTheRepositoryAsync(): Promise<void> {
    const runner = GitHubApiTests.answer({ id: 1 });

    const value = await GitHubApiTests.create(runner).readAsync("/releases/1");

    Assert.areEqual("{\"id\":1}", JSON.stringify(value));
    Assert.areEqual("gh api repos/example/sample-app/releases/1", runner.captured.join("|"));
    Assert.areEqual("/work", runner.folders.join());
  }

  @TestMethod
  public async readsEveryPageAsOneListAsync(): Promise<void> {
    const runner = GitHubApiTests.answer([[{ id: 1 }, { id: 2 }], [{ id: 3 }]]);

    const values = await GitHubApiTests.create(runner).readPagesAsync("/releases");

    Assert.areEqual("[{\"id\":1},{\"id\":2},{\"id\":3}]", JSON.stringify(values));
    Assert.areEqual("gh api --paginate --slurp repos/example/sample-app/releases", runner.captured.join("|"));
  }

  @TestMethod
  public async refusesPagesThatAreNotListsAsync(): Promise<void> {
    for (const pages of [{ id: 1 }, [{ id: 1 }]]) {
      const error = await Assert.throwsAsync(() => GitHubApiTests.create(GitHubApiTests.answer(pages)).readPagesAsync("/releases"), BuildException);

      Assert.areEqual("/releases must be an array.", error.message);
      Assert.isFalse(error instanceof GitHubRequestException);
    }
  }

  @TestMethod
  public async findsTheTagsOwnReferenceAmongThoseThatStartWithItAsync(): Promise<void> {
    const reference = { ref: "refs/tags/v1.2.3", object: { type: "commit", sha: "abc" } };
    const runner = GitHubApiTests.answer([{ ref: "refs/tags/v1.2.30", object: {} }, reference]);

    const found = await GitHubApiTests.create(runner).readTagAsync("v1.2.3");
    const missing = await GitHubApiTests.create(GitHubApiTests.answer([{ ref: "refs/tags/v1.2.30" }])).readTagAsync("v1.2.3");

    Assert.areEqual(JSON.stringify(reference), JSON.stringify(found));
    Assert.isNull(missing);
    Assert.areEqual("gh api repos/example/sample-app/git/matching-refs/tags/v1.2.3", runner.captured.join("|"));
  }

  @TestMethod
  public async refusesTagReferencesOfTheWrongShapeAsync(): Promise<void> {
    const cases: readonly (readonly [unknown, string])[] = [
      [{}, "the references of the tag v1.2.3 must be an array."],
      [[1], "the references of the tag v1.2.3 must be an object."],
      [[{ ref: 1 }], "the references of the tag v1.2.3.ref must be text."]
    ];

    for (const [value, message] of cases) {
      const error = await Assert.throwsAsync(() => GitHubApiTests.create(GitHubApiTests.answer(value)).readTagAsync("v1.2.3"), BuildException);

      Assert.areEqual(message, error.message);
    }
  }

  @TestMethod
  public async readsAMissingResourceAsNothingAndThrowsAnyOtherFailureAsync(): Promise<void> {
    const missing = await GitHubApiTests.create(GitHubApiTests.fail("gh: Not Found (HTTP 404)\n")).readOptionalAsync("/compare/abc...main");
    const failed = await Assert.throwsAsync(() => GitHubApiTests.create(GitHubApiTests.fail("gh: Server Error (HTTP 502)\n")).readOptionalAsync("/compare/abc...main"), GitHubRequestException);
    const offline = await Assert.throwsAsync(() => GitHubApiTests.create(GitHubApiTests.fail("error connecting to api.github.com\n")).readOptionalAsync("/compare/abc...main"), GitHubRequestException);

    Assert.isNull(missing);
    Assert.areEqual(502, failed.status);
    Assert.areEqual("\"gh api repos/example/sample-app/compare/abc...main\" failed with exit code 1: gh: Server Error (HTTP 502)", failed.message);
    Assert.isNull(offline.status);
  }

  @TestMethod
  public async rethrowsAnAnswerThatIsNotJsonFromAnOptionalReadAsync(): Promise<void> {
    const runner = new ScriptedRunnerFixture(() => new ProcessResult(0, "<html>", String.empty));

    const error = await Assert.throwsAsync(() => GitHubApiTests.create(runner).readOptionalAsync("/releases/1"), BuildException);

    Assert.areEqual("GitHub's answer for /releases/1 is not JSON.", error.message);
    Assert.isFalse(error instanceof GitHubRequestException);
    Assert.isTrue(error.cause instanceof Error);
  }

  @TestMethod
  public async sendsEachKindOfRequestWithItsMethodAndFieldsAsync(): Promise<void> {
    const runner = GitHubApiTests.answer({ id: 1 });
    const api = GitHubApiTests.create(runner);

    await api.writeAsync("PUT", "/contents/notes.md", "the notes");
    const created = await api.createAsync("/git/refs", [["ref", "refs/tags/v1.2.3"], ["sha", "abc"]]);
    await api.postAsync("/dispatches");
    const sent = await api.sendAsync("PATCH", "/releases/1", [["make_latest", "true"]], [["draft", false], ["count", 2]]);
    await api.deleteAsync("/releases/assets/9");
    await api.uploadAsync("v1.2.3", "/release/App.AppImage");

    Assert.areEqual("{\"id\":1},{\"id\":1}", [JSON.stringify(created), JSON.stringify(sent)].join());
    Assert.areEqual([
      "gh api --method PUT repos/example/sample-app/contents/notes.md --raw-field body=the notes",
      "gh api --method POST repos/example/sample-app/git/refs --raw-field ref=refs/tags/v1.2.3 --raw-field sha=abc",
      "gh api --method POST repos/example/sample-app/dispatches",
      "gh api --method PATCH repos/example/sample-app/releases/1 --raw-field make_latest=true --field draft=false --field count=2",
      "gh api --method DELETE repos/example/sample-app/releases/assets/9",
      "gh release upload v1.2.3 /release/App.AppImage --repo example/sample-app"
    ].join("\n"), runner.captured.join("\n"));
  }

  private static create(runner: ScriptedRunnerFixture): GitHubApi {
    return new GitHubApi(GitHubApiTests.REPOSITORY, runner, "/work");
  }

  private static answer(value: unknown): ScriptedRunnerFixture {
    return new ScriptedRunnerFixture(() => new ProcessResult(0, JSON.stringify(value), String.empty));
  }

  private static fail(errorOutput: string): ScriptedRunnerFixture {
    return new ScriptedRunnerFixture(() => new ProcessResult(1, String.empty, errorOutput));
  }
}
