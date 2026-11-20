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

import { GitHubRequestException } from "../../../src/exceptions/github-request.exception.js";
import type { IRetryClock } from "../../../src/interfaces/i-retry-clock.js";
import { ReleaseLock } from "../../../src/services/release/release-lock.js";
import { GitHubApi } from "../../../src/services/repository/github-api.js";
import { GitHubLockFixture } from "../../fixtures/github-lock.fixture.js";
import { GitHubReleasesFixture } from "../../fixtures/github-releases.fixture.js";

@TestClass
export class ReleaseLockTests {
  private static readonly REPOSITORY: string = "example/releases";
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly RUN: string = "42";
  private static readonly OTHER: string = "7";

  @TestMethod
  public async takesAFreeLockWithACommitOnTheRevisionThatNamesItsRunAsync(): Promise<void> {
    const github = new GitHubLockFixture();
    github.commits.set(ReleaseLockTests.REVISION, { message: "The app", tree: "the-app-tree", parent: null });

    const result = await ReleaseLockTests.takeAsync(github);

    const lock = github.commits.get(github.lock ?? String.empty);
    Assert.areEqual("Run 42 took the release lock of example/releases.\n", result.output);
    Assert.areEqual(JSON.stringify({ message: "Release lock for run 42", tree: "the-app-tree", parent: ReleaseLockTests.REVISION }), JSON.stringify(lock));
    Assert.areEqual("[]", JSON.stringify(result.pauses));
  }

  @TestMethod
  public async waitsEveryFifteenSecondsWhileAnotherRunHoldsTheLockAndTakesItOnceThatRunLetsGoAsync(): Promise<void> {
    const github = ReleaseLockTests.withRevision();
    github.hold(ReleaseLockTests.OTHER);

    const result = await ReleaseLockTests.takeAsync(github, pauses => {
      if (pauses === 2)
        github.lock = null;
    });

    Assert.areEqual("[15000,15000]", JSON.stringify(result.pauses));
    Assert.areEqual("Run 7 holds the release lock of example/releases, so this run tries again every 15 s until that run lets go of it or ends.\n"
      + "Run 42 took the release lock of example/releases.\n", result.output);
    Assert.areEqual("Release lock for run 42", github.holder());
  }

  @TestMethod
  public async takesOverTheLockOfARunThatEndedOrIsGoneOrOfACommitThatNamesNoRunAsync(): Promise<void> {
    const outputs: string[] = [];
    for (const [run, status] of [[ReleaseLockTests.OTHER, "completed"], [ReleaseLockTests.OTHER, null], [null, null]] as const) {
      const github = ReleaseLockTests.withRevision();
      const stale = github.hold(run, status);

      const result = await ReleaseLockTests.takeAsync(github);

      outputs.push(result.output);
      Assert.areEqual("Release lock for run 42", github.holder());
      Assert.areEqual(stale, github.commits.get(github.lock ?? String.empty)?.parent);
      Assert.areEqual("[]", JSON.stringify(result.pauses));
    }

    Assert.areEqual(JSON.stringify([
      "Run 7 held the release lock of example/releases and has ended without letting go of it, so run 42 took it over.\n",
      "Run 7 held the release lock of example/releases and has ended without letting go of it, so run 42 took it over.\n",
      "A commit that names no run held the release lock of example/releases and has ended without letting go of it, so run 42 took it over.\n"
    ]), JSON.stringify(outputs));
  }

  @TestMethod
  public async holdsTheLockAgainThatAnEarlierAttemptOfItsRunTookAsync(): Promise<void> {
    const github = ReleaseLockTests.withRevision();
    github.hold(ReleaseLockTests.RUN);

    const result = await ReleaseLockTests.takeAsync(github);

    Assert.areEqual("Run 42 already held the release lock of example/releases from an earlier attempt, and holds it again.\n", result.output);
    Assert.areEqual("Release lock for run 42", github.holder());
    Assert.isFalse(github.requests.some(t => t.includes("actions/runs")), github.requests.join("\n"));
  }

  @TestMethod
  public async waitsForARunThatTookTheFreeLockFirstAsync(): Promise<void> {
    const github = ReleaseLockTests.withRevision();
    let raced = false;
    github.intercept = t => {
      if (!raced && t.includes("--method") && t.includes("POST") && t.some(u => u.endsWith("/git/refs"))) {
        raced = true;
        github.hold(ReleaseLockTests.OTHER);
        return GitHubReleasesFixture.fail(422);
      }
      return null;
    };

    const result = await ReleaseLockTests.takeAsync(github, () => github.runs.set(ReleaseLockTests.OTHER, "completed"));

    Assert.areEqual("[15000]", JSON.stringify(result.pauses));
    Assert.areEqual("Run 7 holds the release lock of example/releases, so this run tries again every 15 s until that run lets go of it or ends.\n"
      + "Run 7 held the release lock of example/releases and has ended without letting go of it, so run 42 took it over.\n", result.output);
    Assert.areEqual("Release lock for run 42", github.holder());
  }

  @TestMethod
  public async leavesALockThatAnotherRunTookOverFirstAsync(): Promise<void> {
    const github = ReleaseLockTests.withRevision();
    github.hold(ReleaseLockTests.OTHER, "completed");
    let raced = false;
    github.intercept = t => {
      if (!raced && t.includes("PATCH")) {
        raced = true;
        github.lock = github.addCommit("Release lock for run 8", github.lock);
        github.runs.set("8", "in_progress");
      }
      return null;
    };

    const result = await ReleaseLockTests.takeAsync(github, () => {
      github.lock = null;
    });

    Assert.areEqual("[15000]", JSON.stringify(result.pauses));
    Assert.areEqual("Run 8 holds the release lock of example/releases, so this run tries again every 15 s until that run lets go of it or ends.\n"
      + "Run 42 took the release lock of example/releases.\n", result.output);
  }

  @TestMethod
  public async throwsAFailureOtherThanAnExistingReferenceAsync(): Promise<void> {
    const github = ReleaseLockTests.withRevision();
    github.intercept = t => t.some(u => u.endsWith("/git/refs")) ? GitHubReleasesFixture.fail(500) : null;
    const running = ReleaseLockTests.withRevision();
    running.hold(ReleaseLockTests.OTHER);
    running.intercept = t => t.some(u => u.endsWith("/actions/runs/7")) ? GitHubReleasesFixture.fail(403) : null;

    const broken = ReleaseLockTests.withRevision();
    broken.intercept = t => {
      if (t.some(u => u.endsWith("/git/refs")))
        throw new TypeError("The runner broke.");
      return null;
    };

    const refused = await Assert.throwsAsync(() => ReleaseLockTests.takeAsync(github), GitHubRequestException);
    const unread = await Assert.throwsAsync(() => ReleaseLockTests.takeAsync(running), GitHubRequestException);
    const thrown = await Assert.throwsAsync(() => ReleaseLockTests.takeAsync(broken), TypeError);

    Assert.areEqual(500, refused.status);
    Assert.areEqual(403, unread.status);
    Assert.areEqual("The runner broke.", thrown.message);
    Assert.isNull(github.lock);
  }

  @TestMethod
  public async letsGoOfItsOwnLockOnlyAsync(): Promise<void> {
    const own = new GitHubLockFixture();
    own.hold(ReleaseLockTests.RUN);
    const other = new GitHubLockFixture();
    const kept = other.hold(ReleaseLockTests.OTHER);
    const free = new GitHubLockFixture();

    const outputs = [await ReleaseLockTests.letGoAsync(own), await ReleaseLockTests.letGoAsync(other), await ReleaseLockTests.letGoAsync(free)];

    Assert.areEqual(JSON.stringify([
      "Run 42 let go of the release lock of example/releases.\n",
      "Run 7 holds the release lock of example/releases, not run 42, so it stays.\n",
      "Nothing holds the release lock of example/releases, so there is nothing to let go of.\n"
    ]), JSON.stringify(outputs));
    Assert.isNull(own.lock);
    Assert.areEqual(kept, other.lock);
    Assert.isFalse(other.requests.some(t => t.includes("DELETE")) || free.requests.some(t => t.includes("DELETE")));
  }

  private static withRevision(): GitHubLockFixture {
    const github = new GitHubLockFixture();
    github.commits.set(ReleaseLockTests.REVISION, { message: "The app", tree: "the-app-tree", parent: null });
    return github;
  }

  private static async takeAsync(github: GitHubLockFixture, onPause: (pauses: number) => void = () => undefined): Promise<{ readonly output: string; readonly pauses: readonly number[] }> {
    const pauses: number[] = [];
    const clock: IRetryClock = {
      now: () => 0,
      pauseAsync: (milliseconds: number): Promise<void> => {
        pauses.push(milliseconds);
        onPause(pauses.length);
        return Promise.resolve();
      }
    };
    const [output, chunks] = ReleaseLockTests.capture();
    await new ReleaseLock(new GitHubApi(ReleaseLockTests.REPOSITORY, github, "."), ReleaseLockTests.REPOSITORY, output, clock).takeAsync(ReleaseLockTests.RUN, ReleaseLockTests.REVISION);
    return { output: chunks.join(String.empty), pauses };
  }

  private static async letGoAsync(github: GitHubLockFixture): Promise<string> {
    const [output, chunks] = ReleaseLockTests.capture();
    await new ReleaseLock(new GitHubApi(ReleaseLockTests.REPOSITORY, github, "."), ReleaseLockTests.REPOSITORY, output, { now: () => 0, pauseAsync: () => Promise.resolve() }).letGoAsync(ReleaseLockTests.RUN);
    return chunks.join(String.empty);
  }

  private static capture(): readonly [PassThrough, string[]] {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    return [output, chunks];
  }
}
