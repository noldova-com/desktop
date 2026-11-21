/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ReleaseLocking } from "../../../src/services/commands/release-locking.js";
import { GitHubLockFixture } from "../../fixtures/github-lock.fixture.js";

@TestClass
export class ReleaseLockingTests {
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly ENVIRONMENT: Readonly<Record<string, string>> = { RELEASE_BUILD_REPOSITORY: "example/releases", RELEASE_LOCK_RUN: "42", RELEASE_LOCK_REVISION: ReleaseLockingTests.REVISION };

  @TestMethod
  public async takesAndLetsGoOfTheLockForTheRunItsEnvironmentNamesAsync(): Promise<void> {
    const github = new GitHubLockFixture();
    github.commits.set(ReleaseLockingTests.REVISION, { message: "The app", tree: "the-app-tree", parent: null });

    const taken = await ReleaseLockingTests.runAsync(github, "release-lock", [], ReleaseLockingTests.ENVIRONMENT);
    const holder = github.holder();
    const released = await ReleaseLockingTests.runAsync(github, "release-unlock", [], { ...ReleaseLockingTests.ENVIRONMENT, RELEASE_LOCK_REVISION: String.empty });

    Assert.areEqual("0 Run 42 took the release lock of example/releases.\n", taken);
    Assert.areEqual("Release lock for run 42", holder);
    Assert.areEqual("0 Run 42 let go of the release lock of example/releases.\n", released);
    Assert.isNull(github.lock);
    Assert.isTrue(github.requests.every(t => t.includes("repos/example/releases/")), github.requests.join("\n"));
  }

  @TestMethod
  public async refusesAMissingOrInvalidRepositoryRunOrRevisionWithoutAskingGitHubAsync(): Promise<void> {
    const github = new GitHubLockFixture();
    const cases: readonly (readonly [string, Readonly<Record<string, string>>])[] = [
      ["release-lock", { ...ReleaseLockingTests.ENVIRONMENT, RELEASE_BUILD_REPOSITORY: "releases" }],
      ["release-unlock", { ...ReleaseLockingTests.ENVIRONMENT, RELEASE_LOCK_RUN: String.empty }],
      ["release-lock", { ...ReleaseLockingTests.ENVIRONMENT, RELEASE_LOCK_RUN: "07" }],
      ["release-lock", { ...ReleaseLockingTests.ENVIRONMENT, RELEASE_LOCK_REVISION: "main" }],
      ["release-lock", { RELEASE_BUILD_REPOSITORY: "example/releases", RELEASE_LOCK_RUN: "42" }]
    ];

    const results: string[] = [];
    for (const [command, environment] of cases)
      results.push(await ReleaseLockingTests.runAsync(github, command, [], environment));

    Assert.areEqual(JSON.stringify([
      "1 RELEASE_BUILD_REPOSITORY must be set as the release lock needs it, not \"releases\".\n",
      "1 RELEASE_LOCK_RUN must be set as the release lock needs it, not \"\".\n",
      "1 RELEASE_LOCK_RUN must be set as the release lock needs it, not \"07\".\n",
      "1 RELEASE_LOCK_REVISION must be set as the release lock needs it, not \"main\".\n",
      "1 RELEASE_LOCK_REVISION must be set as the release lock needs it, not \"\".\n"
    ]), JSON.stringify(results));
    Assert.areEqual(0, github.requests.length);
  }

  @TestMethod
  public async answersArgumentsWithItsUsageAsync(): Promise<void> {
    const github = new GitHubLockFixture();

    const lock = await ReleaseLockingTests.runAsync(github, "release-lock", ["now"], ReleaseLockingTests.ENVIRONMENT);
    const unlock = await ReleaseLockingTests.runAsync(github, "release-unlock", ["now"], ReleaseLockingTests.ENVIRONMENT);

    Assert.areEqual("2 Usage: RELEASE_BUILD_REPOSITORY=<owner/name> RELEASE_LOCK_RUN=<run id> RELEASE_LOCK_REVISION=<commit> noldova-desktop-release release-lock\n", lock);
    Assert.areEqual("2 Usage: RELEASE_BUILD_REPOSITORY=<owner/name> RELEASE_LOCK_RUN=<run id> noldova-desktop-release release-unlock\n", unlock);
    Assert.areEqual(0, github.requests.length);
  }

  @TestMethod
  public async reportsAGitHubFailureAndThrowsAnyOtherErrorAsync(): Promise<void> {
    const failing = new GitHubLockFixture();
    const broken = new GitHubLockFixture();
    broken.intercept = () => {
      throw new TypeError("The runner broke.");
    };

    const reported = await ReleaseLockingTests.runAsync(failing, "release-lock", [], ReleaseLockingTests.ENVIRONMENT);
    const thrown = await Assert.throwsAsync(() => ReleaseLockingTests.runAsync(broken, "release-unlock", [], ReleaseLockingTests.ENVIRONMENT), TypeError);

    Assert.isTrue(reported.startsWith("1 \"gh "), reported);
    Assert.isTrue(reported.includes("HTTP 404"), reported);
    Assert.areEqual("The runner broke.", thrown.message);
  }

  private static async runAsync(github: GitHubLockFixture, command: string, lockArguments: readonly string[], environment: Readonly<Record<string, string>>): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    const code = await new ReleaseLocking(".", github, environment, output, "noldova-desktop-release", { now: () => 0, pauseAsync: () => Promise.resolve() }).runAsync(command, lockArguments);
    return `${code} ${chunks.join(String.empty)}`;
  }
}
