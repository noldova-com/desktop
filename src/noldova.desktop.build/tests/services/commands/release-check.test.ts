/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProcessTimeoutException } from "../../../src/exceptions/process-timeout.exception.js";
import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { ReleaseCheck } from "../../../src/services/commands/release-check.js";
import { GitHubReleasesFixture } from "../../fixtures/github-releases.fixture.js";
import { InstalledAppFixture } from "../../fixtures/installed-app.fixture.js";

@TestClass
export class ReleaseCheckTests {
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly OTHER: string = "fedcba9876543210fedcba9876543210fedcba98";
  private static readonly FORK: string = "someone/sample-fork";
  private static readonly OWN_FEED: string = "https://counted.example.test/";
  private static readonly SEPARATE: NodeJS.ProcessEnv = {
    RELEASE_REPOSITORY: "example/downloads",
    RELEASE_SOURCE_REPOSITORY: "example/sample-app",
    RELEASE_TAG_PREFIX: "sample-app-",
    RELEASE_VERSION: "1.2.3",
    RELEASE_REVISION: ReleaseCheckTests.REVISION
  };
  private static readonly BUILT: NodeJS.ProcessEnv = { ...ReleaseCheckTests.SEPARATE, RELEASE_BUILD_REPOSITORY: "example/builds" };

  @TestMethod
  public async checksANewVersionOnMainWhoseRunPassedAndWritesItsOutputsAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const github = ReleaseCheckTests.passing();
    github.addRelease("v1.2.2", ReleaseCheckTests.OTHER, false);
    github.addRelease("v1.1.9", ReleaseCheckTests.OTHER, false);
    github.addRelease("v9.0.0", ReleaseCheckTests.OTHER, true);
    const outputs = await app.writeAppFileAsync("outputs", String.empty);

    const result = await ReleaseCheckTests.runAsync(app.path, github, { ...ReleaseCheckTests.request(ReleaseCheckTests.FORK), GITHUB_OUTPUT: outputs });

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(`v1.2.3 of ${ReleaseCheckTests.FORK} from ${ReleaseCheckTests.REVISION}: the version is new, the revision is on main `
      + "and its Build and test run there passed. Signed platforms: none.\n", result.output);
    Assert.areEqual("signed=\nproduct-feed=\n", await readFile(outputs, "utf8"));
  }

  @TestMethod
  public async namesTheSignedPlatformsAndTheProductsFeedForTheReleaseRepositoryAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ updateFeed: ReleaseCheckTests.OWN_FEED });
    const manifest = await readFile(path.join(app.path, "package.json"), "utf8");
    await app.writeAppFileAsync("package.json", manifest.replace("\"desktop\":{", "\"desktop\":{\"signedPlatforms\":[\"windows\",\"macos\"],"));
    const outputs = await app.writeAppFileAsync("outputs", "earlier=1\n");

    const result = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.passing(), { ...ReleaseCheckTests.request("example/sample-app"), GITHUB_OUTPUT: outputs });

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.isTrue(result.output.endsWith("Signed platforms: windows, macos.\n"), result.output);
    Assert.areEqual(`earlier=1\nsigned=windows macos\nproduct-feed=${ReleaseCheckTests.OWN_FEED}\n`, await readFile(outputs, "utf8"));
  }

  @TestMethod
  public async writesAnEmptyFeedForTheReleaseRepositoryOfAProductWithoutAFeedAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const manifest = await readFile(path.join(app.path, "package.json"), "utf8");
    await app.writeAppFileAsync("package.json", manifest.replace("\"desktop\":{", "\"desktop\":{\"signedPlatforms\":[\"windows\",\"macos\"],"));
    const outputs = await app.writeAppFileAsync("outputs", String.empty);

    const result = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.passing(), { ...ReleaseCheckTests.request("example/sample-app"), GITHUB_OUTPUT: outputs });

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual("signed=windows macos\nproduct-feed=\n", await readFile(outputs, "utf8"));
  }

  @TestMethod
  public async writesNoOutputsWithoutAStepOutputFileAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const result = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.passing(), ReleaseCheckTests.request(ReleaseCheckTests.FORK));

    Assert.areEqual(0, result.exitCode, result.output);
  }

  @TestMethod
  public async refusesAVersionTheRootManifestDoesNotNameOrThatIsNotNewerAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const released = ReleaseCheckTests.passing();
    for (const tag of ["v1.2.0", "v1.3.0", "v1.1.0"])
      released.addRelease(tag, ReleaseCheckTests.OTHER, false);

    const other = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.passing(), { ...ReleaseCheckTests.request(ReleaseCheckTests.FORK), RELEASE_VERSION: "1.2.4" });
    const older = await ReleaseCheckTests.runAsync(app.path, released, ReleaseCheckTests.request(ReleaseCheckTests.FORK));

    Assert.areEqual("The root manifest's version is 1.2.3, not 1.2.4; raise it on main first, or let the release set it.\n", other.output);
    Assert.areEqual("1.2.3 is not newer than the highest release, 1.3.0.\n", older.output);
    Assert.areEqual("1,1", [other.exitCode, older.exitCode].join());
  }

  @TestMethod
  public async takesAVersionTheRootManifestDoesNotNameWhenTheReleaseSetsItAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const released = ReleaseCheckTests.passing();
    released.addRelease("v1.2.3", ReleaseCheckTests.OTHER, false);
    const request = { ...ReleaseCheckTests.request(ReleaseCheckTests.FORK), RELEASE_VERSION: "1.2.4" };

    const set = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.passing(), { ...request, RELEASE_SETS_VERSION: "true" });
    const kept = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.passing(), { ...request, RELEASE_SETS_VERSION: "false" });
    const older = await ReleaseCheckTests.runAsync(app.path, released, { ...ReleaseCheckTests.request(ReleaseCheckTests.FORK), RELEASE_SETS_VERSION: "true" });

    Assert.areEqual(`v1.2.4 of ${ReleaseCheckTests.FORK} from ${ReleaseCheckTests.REVISION}: the version is new, the revision is on main `
      + "and its Build and test run there passed. Signed platforms: none.\n", set.output);
    Assert.areEqual("The root manifest's version is 1.2.3, not 1.2.4; raise it on main first, or let the release set it.\n", kept.output);
    Assert.areEqual("1.2.3 is not newer than the highest release, 1.2.3.\n", older.output);
    Assert.areEqual("0,1,1", [set.exitCode, kept.exitCode, older.exitCode].join());
  }

  @TestMethod
  public async refusesAValueOfTheSetVersionFlagThatIsNotTrueOrFalseAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();

    const result = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.passing(), { ...ReleaseCheckTests.request(ReleaseCheckTests.FORK), RELEASE_SETS_VERSION: "yes" });

    Assert.areEqual("RELEASE_SETS_VERSION must be true or false, not \"yes\".\n", result.output);
    Assert.areEqual(1, result.exitCode);
  }

  @TestMethod
  public async checksARevisionInItsSourceAndTheVersionAgainstItsOwnTagsInAnotherRepositoryAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ updateFeed: ReleaseCheckTests.OWN_FEED });
    const github = ReleaseCheckTests.passing();
    github.addRelease("other-app-9.0.0", ReleaseCheckTests.OTHER, false);
    github.addRelease("v9.0.0", ReleaseCheckTests.OTHER, false);
    github.addRelease("sample-app-1.2.2", ReleaseCheckTests.OTHER, false);
    const released = ReleaseCheckTests.passing();
    released.addRelease("sample-app-1.3.0", ReleaseCheckTests.OTHER, false);

    const result = await ReleaseCheckTests.runAsync(app.path, github, ReleaseCheckTests.SEPARATE);
    const older = await ReleaseCheckTests.runAsync(app.path, released, ReleaseCheckTests.SEPARATE);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(`sample-app-1.2.3 of example/downloads from ${ReleaseCheckTests.REVISION}: the version is new, the revision is on main `
      + "and its Build and test run there passed. Signed platforms: none.\n", result.output);
    Assert.areEqual("1.2.3 is not newer than the highest release, 1.3.0.\n", older.output);
    const asked = github.requests.map(t => (t.split(" ").find(u => u.startsWith("repos/")) ?? String.empty).split(/[/?]/u).slice(1, 4).join("/"));
    Assert.areEqual("example/downloads/releases,example/downloads/git,example/sample-app/compare,example/sample-app/actions", [...new Set(asked)].join());
  }

  @TestMethod
  public async checksThatASourceBuiltInAnotherRepositoryIsPublicAndItsRevisionOnItsMainAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ updateFeed: ReleaseCheckTests.OWN_FEED });
    const github = ReleaseCheckTests.describing(ReleaseCheckTests.passing(), { private: false });
    const behind = ReleaseCheckTests.describing(ReleaseCheckTests.answering({ status: "behind" }, []), { private: false });
    const missing = ReleaseCheckTests.describing(ReleaseCheckTests.answering(null, []), { private: false });

    const result = await ReleaseCheckTests.runAsync(app.path, github, ReleaseCheckTests.BUILT);
    const elsewhere = await ReleaseCheckTests.runAsync(app.path, behind, ReleaseCheckTests.BUILT);
    const unknown = await ReleaseCheckTests.runAsync(app.path, missing, ReleaseCheckTests.BUILT);

    Assert.areEqual(0, result.exitCode, result.output);
    const asked = github.requests.map(t => (t.split(" ").find(u => u.startsWith("repos/")) ?? String.empty).split(/[/?]/u).slice(1, 4).join("/"));
    Assert.areEqual("example/downloads/releases,example/downloads/git,example/sample-app,example/sample-app/compare,example/sample-app/actions", [...new Set(asked)].join());
    Assert.areEqual(`${ReleaseCheckTests.REVISION} is not on main; main is behind compared with it.\n`, elsewhere.output);
    Assert.areEqual(`${ReleaseCheckTests.REVISION} is not a commit of example/sample-app.\n`, unknown.output);
    Assert.areEqual("1,1", [elsewhere.exitCode, unknown.exitCode].join());
  }

  @TestMethod
  public async refusesASourceBuiltInAnotherRepositoryThatIsPrivateOrMissingAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync({ updateFeed: ReleaseCheckTests.OWN_FEED });
    const hidden = ReleaseCheckTests.describing(ReleaseCheckTests.passing(), { private: true });

    const secret = await ReleaseCheckTests.runAsync(app.path, hidden, ReleaseCheckTests.BUILT);
    const absent = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.passing(), ReleaseCheckTests.BUILT);

    const message = "The release runs in example/builds and reads its source example/sample-app with the run's own token, which reads no other private repository, so example/sample-app must be public; "
      + "it is private or doesn't exist.\n";
    Assert.areEqual(message, secret.output);
    Assert.areEqual(message, absent.output);
    Assert.areEqual("1,1", [secret.exitCode, absent.exitCode].join());
    Assert.isFalse(hidden.requests.some(t => t.includes("/compare/")), hidden.requests.join("\n"));
  }

  @TestMethod
  public async refusesAnotherRepositoryForAProductWithoutAFeedOrWhereItsTagExistsAsync(): Promise<void> {
    await using unnamed = await InstalledAppFixture.createAsync();
    await using named = await InstalledAppFixture.createAsync({ updateFeed: ReleaseCheckTests.OWN_FEED });
    const tagged = ReleaseCheckTests.passing();
    tagged.tags.set("sample-app-1.2.3", ReleaseCheckTests.REVISION);

    const feedless = await ReleaseCheckTests.runAsync(unnamed.path, ReleaseCheckTests.passing(), ReleaseCheckTests.SEPARATE);
    const taken = await ReleaseCheckTests.runAsync(named.path, tagged, ReleaseCheckTests.SEPARATE);

    Assert.areEqual("The release publishes in example/downloads, not in its source repository example/sample-app, so product.json must name its updateFeed: "
      + "the latest release of example/downloads may be another app's.\n", feedless.output);
    Assert.areEqual("The tag sample-app-1.2.3 already exists in example/downloads, which isn't the source repository, so it can't be this release's own; this release needs a new version.\n",
      taken.output);
    Assert.areEqual("1,1", [feedless.exitCode, taken.exitCode].join());
  }

  @TestMethod
  public async refusesATagThatPointsElsewhereAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const github = ReleaseCheckTests.passing();
    github.tags.set("v1.2.3", ReleaseCheckTests.OTHER);

    const result = await ReleaseCheckTests.runAsync(app.path, github, ReleaseCheckTests.request(ReleaseCheckTests.FORK));

    Assert.areEqual(1, result.exitCode);
    Assert.areEqual(`The tag v1.2.3 already points at ${ReleaseCheckTests.OTHER}, not at ${ReleaseCheckTests.REVISION}; a tag is never moved, so this release needs a new version.\n`, result.output);
  }

  @TestMethod
  public async refusesARevisionThatIsNoCommitOrNotOnMainAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const missing = ReleaseCheckTests.answering(null, []);
    const behind = ReleaseCheckTests.answering({ status: "behind" }, []);

    const unknown = await ReleaseCheckTests.runAsync(app.path, missing, ReleaseCheckTests.request(ReleaseCheckTests.FORK));
    const elsewhere = await ReleaseCheckTests.runAsync(app.path, behind, ReleaseCheckTests.request(ReleaseCheckTests.FORK));

    Assert.areEqual(`${ReleaseCheckTests.REVISION} is not a commit of ${ReleaseCheckTests.FORK}.\n`, unknown.output);
    Assert.areEqual(`${ReleaseCheckTests.REVISION} is not on main; main is behind compared with it.\n`, elsewhere.output);
  }

  @TestMethod
  public async refusesARevisionWithoutAPassedBuildRunAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const cases: readonly (readonly [readonly unknown[], string])[] = [
      [[], `No Build and test run on main has checked ${ReleaseCheckTests.REVISION}; release a revision whose run on main passed.`],
      [[{ conclusion: null, status: "in_progress" }], `The Build and test run on main for ${ReleaseCheckTests.REVISION} is in_progress, not success; release a revision whose run on main passed.`],
      [[{ conclusion: "failure", status: "completed" }], `The Build and test run on main for ${ReleaseCheckTests.REVISION} is failure, not success; release a revision whose run on main passed.`]
    ];

    for (const [runs, message] of cases) {
      const result = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.answering({ status: "identical" }, runs), ReleaseCheckTests.request(ReleaseCheckTests.FORK));

      Assert.areEqual(1, result.exitCode, message);
      Assert.areEqual(`${message}\n`, result.output);
    }
  }

  @TestMethod
  public async reportsAFailureOfTheRequestAPackageGitHubOrItsProgramAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const failing = new GitHubReleasesFixture();
    failing.intercept = () => GitHubReleasesFixture.fail(500);
    const stuck = new GitHubReleasesFixture();
    stuck.intercept = () => {
      throw new ProcessTimeoutException("gh", 60000);
    };

    const request = await ReleaseCheckTests.runAsync(app.path, ReleaseCheckTests.passing(), {});
    const unreadable = await ReleaseCheckTests.runAsync(path.join(app.path, "missing"), ReleaseCheckTests.passing(), ReleaseCheckTests.request(ReleaseCheckTests.FORK));
    const failed = await ReleaseCheckTests.runAsync(app.path, failing, ReleaseCheckTests.request(ReleaseCheckTests.FORK));
    const timedOut = await ReleaseCheckTests.runAsync(app.path, stuck, ReleaseCheckTests.request(ReleaseCheckTests.FORK));

    Assert.areEqual("RELEASE_REPOSITORY must name a repository as owner/name, not \"\".\n", request.output);
    Assert.areEqual(`${Resources.rootVersionInvalid}\n`, unreadable.output);
    Assert.isTrue(failed.output.endsWith("(HTTP 500)\n"), failed.output);
    Assert.areEqual("\"gh\" did not finish within 60000 ms.\n", timedOut.output);
    Assert.areEqual("1,1,1,1", [request.exitCode, unreadable.exitCode, failed.exitCode, timedOut.exitCode].join());
  }

  @TestMethod
  public async throwsAFailureThatIsNotTheChecksOwnAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const outputs = path.join(app.path, "outputs");
    await mkdir(outputs);
    const check = new ReleaseCheck(app.path, ReleaseCheckTests.passing(), { ...ReleaseCheckTests.request(ReleaseCheckTests.FORK), GITHUB_OUTPUT: outputs }, new PassThrough());

    const error = await Assert.throwsAsync(() => check.runAsync([]), Error);

    Assert.isFalse(error instanceof BuildException, error.message);
  }

  @TestMethod
  public async answersAnArgumentWithItsUsageAsync(): Promise<void> {
    await using app = await InstalledAppFixture.createAsync();
    const output = new PassThrough();

    const exitCode = await new ReleaseCheck(app.path, ReleaseCheckTests.passing(), {}, output, "noldova-desktop-release").runAsync(["now"]);

    Assert.areEqual(2, exitCode);
    Assert.areEqual(Resources.formatReleaseCheckUsage("noldova-desktop-release"), output.read(output.readableLength)?.toString() ?? String.empty);
  }

  private static request(repository: string): NodeJS.ProcessEnv {
    return { RELEASE_REPOSITORY: repository, RELEASE_VERSION: "1.2.3", RELEASE_REVISION: ReleaseCheckTests.REVISION };
  }

  private static passing(): GitHubReleasesFixture {
    return ReleaseCheckTests.answering({ status: "ahead" }, [{ conclusion: "success", status: "completed" }]);
  }

  private static answering(comparison: unknown, runs: readonly unknown[]): GitHubReleasesFixture {
    const github = new GitHubReleasesFixture();
    github.intercept = t => {
      const resource = t.find(u => u.startsWith("repos/")) ?? String.empty;
      if (resource.includes("/compare/"))
        return Object.isNull(comparison) ? GitHubReleasesFixture.fail(404) : GitHubReleasesFixture.ok(comparison);
      if (resource.includes("/actions/"))
        return GitHubReleasesFixture.ok({ workflow_runs: runs });
      return null;
    };
    return github;
  }

  private static describing(github: GitHubReleasesFixture, repository: unknown): GitHubReleasesFixture {
    const answer = github.intercept;
    github.intercept = t => t.includes("repos/example/sample-app") ? GitHubReleasesFixture.ok(repository) : answer(t);
    return github;
  }

  private static async runAsync(root: string, github: GitHubReleasesFixture, environment: NodeJS.ProcessEnv): Promise<{ readonly exitCode: number; readonly output: string }> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    const exitCode = await new ReleaseCheck(root, github, environment, output).runAsync([]);
    return { exitCode, output: chunks.join(String.empty) };
  }
}
