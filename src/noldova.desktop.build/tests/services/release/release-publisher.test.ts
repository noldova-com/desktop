/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { GitHubRequestException } from "../../../src/exceptions/github-request.exception.js";
import { ProcessTimeoutException } from "../../../src/exceptions/process-timeout.exception.js";
import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { PackageDigest } from "../../../src/models/release/package-digest.js";
import { ReleaseFile } from "../../../src/models/release/release-file.js";
import { ReleaseRequest } from "../../../src/models/release/release-request.js";
import { ReleasePublisher } from "../../../src/services/release/release-publisher.js";
import { GitHubApi } from "../../../src/services/repository/github-api.js";
import { GitHubReleasesFixture } from "../../fixtures/github-releases.fixture.js";
import { PausedTimersFixture } from "../../fixtures/paused-timers.fixture.js";

@TestClass
export class ReleasePublisherTests {
  private static readonly REVISION: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly OTHER: string = "fedcba9876543210fedcba9876543210fedcba98";
  private static readonly TAG: string = "v1.2.3";
  private static readonly PAUSE: number = 10_000;
  private static readonly SEPARATE: Readonly<Record<string, string>> = { RELEASE_REPOSITORY: "example/downloads", RELEASE_SOURCE_REPOSITORY: "example/sample-app", RELEASE_TAG_PREFIX: "sample-app-" };
  private static readonly FILES: readonly (readonly [string, Buffer])[] = [["Sample App-1.2.3-linux-x64.AppImage", Buffer.from("the package")], ["latest-linux-x64.yml", Buffer.from("version: 1.2.3\n")]];

  @TestMethod
  public async createsADraftUploadsEveryFileTagsTheRevisionAndPublishesItAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();

    const output = await ReleasePublisherTests.publishAsync(github);

    const [release] = github.releases;
    Assert.areEqual(`Creating the draft release ${ReleasePublisherTests.TAG} for ${ReleasePublisherTests.REVISION}.\n`
      + `Published ${ReleasePublisherTests.TAG} from ${ReleasePublisherTests.REVISION} with 2 files.\n`, output);
    Assert.isFalse(release?.isDraft ?? true);
    Assert.areEqual("Sample App-1.2.3-linux-x64.AppImage,latest-linux-x64.yml", release?.assets.map(t => t.name).join());
    Assert.areEqual(ReleasePublisherTests.REVISION, github.tags.get(ReleasePublisherTests.TAG));
    Assert.isTrue(github.requests.some(t => t.includes("--raw-field body=The notes.") && t.includes("--field draft=true")), github.requests.join("\n"));
    Assert.isTrue(github.requests.some(t => t.includes("--raw-field make_latest=true --field draft=false")), github.requests.join("\n"));
  }

  @TestMethod
  public async refusesAVersionThatANewerReleaseOvertookAfterItsCheckAsync(): Promise<void> {
    const before = new GitHubReleasesFixture();
    before.addRelease("v1.2.4", ReleasePublisherTests.OTHER, false);
    const during = new GitHubReleasesFixture();
    let added = false;
    during.intercept = t => {
      if (!added && t[0] === "release" && t[1] === "upload") {
        added = true;
        during.addRelease("v1.2.4", ReleasePublisherTests.OTHER, false);
      }
      return null;
    };

    const early = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(before), BuildException);
    const late = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(during), BuildException);

    const message = "1.2.3 is not newer than the highest release, 1.2.4, which another run published after this one's check, so 1.2.3 is not published; release a version newer than 1.2.4.";
    Assert.areEqual(message, early.message);
    Assert.areEqual(message, late.message);
    Assert.areEqual("v1.2.4", before.releases.map(t => t.tag).join());
    Assert.isTrue(during.releases.find(t => t.tag === ReleasePublisherTests.TAG)?.isDraft ?? false, JSON.stringify(during.releases.map(t => [t.tag, t.isDraft])));
    Assert.isFalse(before.tags.has(ReleasePublisherTests.TAG) || during.tags.has(ReleasePublisherTests.TAG));
    Assert.isFalse(during.requests.some(t => t.includes("--field draft=false")), during.requests.join("\n"));
  }

  @TestMethod
  public async leavesAReleaseThatIsAlreadyPublishedWithEveryFileAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    github.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, false, ReleasePublisherTests.FILES.map(([name, bytes]) => github.createAsset(name, bytes)));
    github.tags.set(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION);

    const output = await ReleasePublisherTests.publishAsync(github);

    Assert.areEqual(`${ReleasePublisherTests.TAG} is already published with every file as built; nothing changed.\n`, output);
    Assert.isFalse(github.requests.some(t => t.startsWith("release upload")));
  }

  @TestMethod
  public async refusesAPublishedReleaseThatDiffersOrWhoseTagMovedAsync(): Promise<void> {
    const differing = new GitHubReleasesFixture();
    const [first] = ReleasePublisherTests.FILES;
    differing.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, false, [differing.createAsset(first?.[0] ?? String.empty, first?.[1] ?? Buffer.alloc(0)),
      differing.createAsset("notes.txt", Buffer.from("notes"))]);
    const moved = new GitHubReleasesFixture();
    moved.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, false, ReleasePublisherTests.FILES.map(([name, bytes]) => moved.createAsset(name, bytes)));
    moved.tags.set(ReleasePublisherTests.TAG, ReleasePublisherTests.OTHER);
    const untagged = new GitHubReleasesFixture();
    untagged.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, false, ReleasePublisherTests.FILES.map(([name, bytes]) => untagged.createAsset(name, bytes)));

    const differs = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(differing), BuildException);
    const elsewhere = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(moved), BuildException);
    const nothing = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(untagged), BuildException);

    Assert.areEqual(`${ReleasePublisherTests.TAG} on GitHub differs from the built files. Missing: latest-linux-x64.yml. Not part of the release: notes.txt.`, differs.message);
    Assert.areEqual(`The tag ${ReleasePublisherTests.TAG} points at ${ReleasePublisherTests.OTHER}, not at ${ReleasePublisherTests.REVISION}.`, elsewhere.message);
    Assert.areEqual(`The tag ${ReleasePublisherTests.TAG} points at nothing, not at ${ReleasePublisherTests.REVISION}.`, nothing.message);
  }

  @TestMethod
  public async refusesATagSharedByReleasesADraftForAnotherRevisionOrATagThatMovedAsync(): Promise<void> {
    const shared = new GitHubReleasesFixture();
    shared.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, true);
    shared.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, false);
    shared.addRelease("v1.2.2", ReleasePublisherTests.REVISION, false);
    const other = new GitHubReleasesFixture();
    other.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.OTHER, true);
    const tagged = new GitHubReleasesFixture();
    tagged.tags.set(ReleasePublisherTests.TAG, ReleasePublisherTests.OTHER);

    const messages: string[] = [];
    for (const github of [shared, other, tagged])
      messages.push((await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(github), BuildException)).message);

    Assert.areEqual(JSON.stringify([
      `2 releases use the tag ${ReleasePublisherTests.TAG}; delete all but one by hand before publishing.`,
      `The draft release ${ReleasePublisherTests.TAG} is for ${ReleasePublisherTests.OTHER}, not for ${ReleasePublisherTests.REVISION}; delete the draft by hand to publish ${ReleasePublisherTests.REVISION}.`,
      `The tag ${ReleasePublisherTests.TAG} already points at ${ReleasePublisherTests.OTHER}, not at ${ReleasePublisherTests.REVISION}; a tag is never moved, so this release needs a new version.`
    ]), JSON.stringify(messages));
    Assert.areEqual(0, tagged.releases.length);
  }

  @TestMethod
  public async finishesAnExistingDraftAndReplacesAnIncompleteUploadAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    const [first, second] = ReleasePublisherTests.FILES;
    const draft = github.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, true, [
      github.createAsset(first?.[0] ?? String.empty, first?.[1] ?? Buffer.alloc(0)),
      github.createAsset(second?.[0] ?? String.empty, second?.[1] ?? Buffer.alloc(0), "starter")
    ]);
    const incomplete = draft.assets[1]?.id;

    const output = await ReleasePublisherTests.publishAsync(github);

    Assert.areEqual("Deleting the incomplete upload of latest-linux-x64.yml.\n"
      + `Published ${ReleasePublisherTests.TAG} from ${ReleasePublisherTests.REVISION} with 2 files.\n`, output);
    Assert.areEqual(1, github.requests.filter(t => t.startsWith("release upload")).length);
    Assert.isTrue(github.requests.some(t => t.endsWith(`releases/assets/${String(incomplete)}`)), github.requests.join("\n"));
  }

  @TestMethod
  public async replacesADraftFileThatDiffersFromTheBuiltOneAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    const [first] = ReleasePublisherTests.FILES;
    const draft = github.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, true, [github.createAsset(first?.[0] ?? String.empty, Buffer.from("another package"))]);
    const earlier = draft.assets[0]?.id;

    const output = await ReleasePublisherTests.publishAsync(github);

    Assert.areEqual("Replacing Sample App-1.2.3-linux-x64.AppImage, which the draft holds from an earlier run and which differs from the built file.\n"
      + `Published ${ReleasePublisherTests.TAG} from ${ReleasePublisherTests.REVISION} with 2 files.\n`, output);
    Assert.areEqual(2, github.requests.filter(t => t.startsWith("release upload")).length);
    Assert.isTrue(github.requests.some(t => t.endsWith(`releases/assets/${String(earlier)}`)), github.requests.join("\n"));
  }

  @TestMethod
  public async refusesAFileThisRunUploadedThatDiffersFromTheBuiltOneAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    const [first] = ReleasePublisherTests.FILES;
    const draft = github.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, true, []);
    github.intercept = t => {
      if (t[0] !== "release" || t[3]?.endsWith(".AppImage") !== true)
        return null;
      draft.assets.push(github.createAsset(first?.[0] ?? String.empty, Buffer.from("another package")));
      return GitHubReleasesFixture.ok(null);
    };
    const built = PackageDigest.fromBytes(first?.[1] ?? Buffer.alloc(0));

    const error = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(github), BuildException);

    Assert.areEqual(`Sample App-1.2.3-linux-x64.AppImage on GitHub has 15 bytes and ${GitHubReleasesFixture.digest(Buffer.from("another package"))}, `
      + `but the built file has ${built.size} bytes and sha256:${built.sha256}. A release's files are never replaced.`, error.message);
    Assert.areEqual(1, github.requests.filter(t => t.startsWith("release upload")).length);
  }

  @TestMethod
  public async triesAnUploadAgainAfterATransientFailureAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    let uploads = 0;
    github.intercept = t => {
      if (t[0] !== "release" || t[3]?.endsWith(".yml") !== true)
        return null;
      uploads += 1;
      if (uploads === 1)
        throw new ProcessTimeoutException("gh", 60000);
      return uploads === 2 ? GitHubReleasesFixture.fail(502) : null;
    };

    const output = await PausedTimersFixture.withoutPausesAsync(() => ReleasePublisherTests.publishAsync(github), ReleasePublisherTests.PAUSE);

    Assert.areEqual(3, uploads);
    Assert.isTrue(output.includes("Uploading latest-linux-x64.yml failed on attempt 1 of 3: \"gh\" did not finish within 60000 ms.\n"), output);
    Assert.isTrue(output.includes("Uploading latest-linux-x64.yml failed on attempt 2 of 3: \"gh release upload "), output);
    Assert.isTrue(output.endsWith(`Published ${ReleasePublisherTests.TAG} from ${ReleasePublisherTests.REVISION} with 2 files.\n`), output);
  }

  @TestMethod
  public async triesAgainAfterAFailureWithoutAStatusOrWithATransientStatusAsync(): Promise<void> {
    for (const errorOutput of ["error connecting to uploads.github.com\n", "gh: timeout (HTTP 408)\n", "gh: rate limited (HTTP 429)\n"]) {
      const github = new GitHubReleasesFixture();
      let failed = false;
      github.intercept = t => {
        if (t[0] !== "release" || failed)
          return null;
        failed = true;
        return new ProcessResult(1, String.empty, errorOutput);
      };

      const output = await PausedTimersFixture.withoutPausesAsync(() => ReleasePublisherTests.publishAsync(github), ReleasePublisherTests.PAUSE);

      Assert.isTrue(output.includes("Uploading Sample App-1.2.3-linux-x64.AppImage failed on attempt 1 of 3: "), output);
      Assert.isTrue(output.endsWith("with 2 files.\n"), output);
    }
  }

  @TestMethod
  public async throwsAnUploadFailureThatIsNotTransientAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    github.intercept = t => t[0] === "release" ? GitHubReleasesFixture.fail(403) : null;

    const error = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(github), GitHubRequestException);

    Assert.areEqual(403, error.status);
    Assert.areEqual(1, github.requests.filter(t => t.startsWith("release upload")).length);
  }

  @TestMethod
  public async givesUpOnAFileThatNeverAppearsAfterItsUploadsAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    github.intercept = t => t[0] === "release" ? GitHubReleasesFixture.ok(null) : null;

    const error = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(github), BuildException);

    Assert.areEqual("Sample App-1.2.3-linux-x64.AppImage is still not uploaded after 3 attempts.", error.message);
    Assert.areEqual(3, github.requests.filter(t => t.startsWith("release upload")).length);
  }

  @TestMethod
  public async refusesADraftThatHoldsAFileTheReleaseDoesNotShipAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    github.addRelease(ReleasePublisherTests.TAG, ReleasePublisherTests.REVISION, true, [github.createAsset("notes.txt", Buffer.from("notes"))]);

    const error = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(github), BuildException);

    Assert.areEqual(`${ReleasePublisherTests.TAG} on GitHub differs from the built files. Missing: none. Not part of the release: notes.txt.`, error.message);
    Assert.isFalse(github.tags.has(ReleasePublisherTests.TAG));
  }

  @TestMethod
  public async acceptsATagThatAppearedOnTheRevisionMeanwhileAsync(): Promise<void> {
    const github = ReleasePublisherTests.tagAppearing(ReleasePublisherTests.REVISION);

    const output = await ReleasePublisherTests.publishAsync(github);

    Assert.isTrue(output.endsWith("with 2 files.\n"), output);
  }

  @TestMethod
  public async refusesATagThatAppearedElsewhereOrFailsForAnotherReasonAsync(): Promise<void> {
    const elsewhere = ReleasePublisherTests.tagAppearing(ReleasePublisherTests.OTHER);
    const vanished = new GitHubReleasesFixture();
    vanished.intercept = t => t.some(u => u.endsWith("/git/refs")) ? GitHubReleasesFixture.fail(422) : null;
    const forbidden = new GitHubReleasesFixture();
    forbidden.intercept = t => t.some(u => u.endsWith("/git/refs")) ? GitHubReleasesFixture.fail(403) : null;

    const appeared = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(elsewhere), BuildException);
    const missing = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(vanished), GitHubRequestException);
    const refused = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(forbidden), GitHubRequestException);

    Assert.areEqual(`The tag ${ReleasePublisherTests.TAG} appeared on ${ReleasePublisherTests.OTHER}, not on ${ReleasePublisherTests.REVISION}, so the draft stays unpublished.`, appeared.message);
    Assert.areEqual("422,403", [missing.status, refused.status].join());
    Assert.isTrue(vanished.releases.every(t => t.isDraft));
  }

  @TestMethod
  public async refusesAReleaseGitHubKeptAsADraftAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    github.intercept = t => {
      const release = github.releases[0];
      return t.includes("--method") && t.includes("PATCH") && !Object.isUndefined(release)
        ? GitHubReleasesFixture.ok({ id: release.id, tag_name: release.tag, target_commitish: release.target, draft: true, assets: release.assets }) : null;
    };

    const error = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(github), BuildException);

    Assert.areEqual(`GitHub kept ${ReleasePublisherTests.TAG} as a draft when it was published.`, error.message);
  }

  @TestMethod
  public async reportsACheckThatFailsAfterPublishingWithItsCauseAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    github.intercept = t => {
      if (t.includes("PATCH"))
        github.tags.set(ReleasePublisherTests.TAG, ReleasePublisherTests.OTHER);
      return null;
    };

    const error = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(github), BuildException);

    Assert.isTrue(error.message.startsWith(`${ReleasePublisherTests.TAG} is public now, but checking it after publishing failed: BuildException: The tag ${ReleasePublisherTests.TAG} points at `),
      error.message);
    Assert.isTrue(error.message.endsWith(" Check it by hand; a published release is never replaced."), error.message);
    Assert.isInstanceOf(error.cause, BuildException);
  }

  @TestMethod
  public async publishesInAnotherRepositoryWithoutTaggingTheSourceRevisionAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    const output = await ReleasePublisherTests.publishAsync(github, ReleasePublisherTests.SEPARATE);
    const [release] = github.releases;

    Assert.areEqual(`Creating the draft release sample-app-1.2.3 for ${ReleasePublisherTests.REVISION}.\n`
      + `Published sample-app-1.2.3 from ${ReleasePublisherTests.REVISION} with 2 files.\n`, output);
    Assert.areEqual("sample-app-1.2.3,,false", [release?.tag, release?.target, release?.isDraft].join());
    Assert.areEqual(github.defaultBranchHead, github.tags.get("sample-app-1.2.3"));
    Assert.isTrue(github.requests.some(t => t.includes("--raw-field tag_name=sample-app-1.2.3 --raw-field name=sample-app-1.2.3 --raw-field body=The notes.")), github.requests.join("\n"));
    Assert.isFalse(github.requests.some(t => t.includes("target_commitish") || t.endsWith("/git/refs")), github.requests.join("\n"));
  }

  @TestMethod
  public async fillsADraftInAnotherRepositoryWhateverBranchItTargetsAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    github.addRelease("sample-app-1.2.3", "main", true);

    await ReleasePublisherTests.publishAsync(github, ReleasePublisherTests.SEPARATE);

    Assert.areEqual("1,false,2", [github.releases.length, github.releases[0]?.isDraft, github.releases[0]?.assets.length].join());
  }

  @TestMethod
  public async refusesATagInAnotherRepositoryThatIsNotItsOwnReleaseAsync(): Promise<void> {
    const github = new GitHubReleasesFixture();
    github.tags.set("sample-app-1.2.3", ReleasePublisherTests.REVISION);

    const error = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(github, ReleasePublisherTests.SEPARATE), BuildException);

    Assert.areEqual("The tag sample-app-1.2.3 already exists in example/downloads, which isn't the source repository, so it can't be this release's own; this release needs a new version.", error.message);
    Assert.areEqual(0, github.releases.length);
  }

  @TestMethod
  public async leavesAPublishedReleaseInAnotherRepositoryAndRefusesOneWithoutItsTagAsync(): Promise<void> {
    const tagged = new GitHubReleasesFixture();
    tagged.addRelease("sample-app-1.2.3", "main", false, ReleasePublisherTests.FILES.map(([name, bytes]) => tagged.createAsset(name, bytes)));
    tagged.tags.set("sample-app-1.2.3", ReleasePublisherTests.OTHER);
    const untagged = new GitHubReleasesFixture();
    untagged.addRelease("sample-app-1.2.3", "main", false, ReleasePublisherTests.FILES.map(([name, bytes]) => untagged.createAsset(name, bytes)));
    const unmade = new GitHubReleasesFixture();
    unmade.defaultBranchHead = null;

    const output = await ReleasePublisherTests.publishAsync(tagged, ReleasePublisherTests.SEPARATE);
    const missing = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(untagged, ReleasePublisherTests.SEPARATE), BuildException);
    const late = await Assert.throwsAsync(() => ReleasePublisherTests.publishAsync(unmade, ReleasePublisherTests.SEPARATE), BuildException);

    Assert.areEqual("sample-app-1.2.3 is already published with every file as built; nothing changed.\n", output);
    Assert.areEqual("The tag sample-app-1.2.3 doesn't exist in example/downloads, though its release is published.", missing.message);
    Assert.areEqual("sample-app-1.2.3 is public now, but checking it after publishing failed: "
      + "BuildException: The tag sample-app-1.2.3 doesn't exist in example/downloads, though its release is published. Check it by hand; a published release is never replaced.", late.message);
  }

  private static tagAppearing(commit: string): GitHubReleasesFixture {
    const github = new GitHubReleasesFixture();
    github.intercept = t => {
      if (t.some(u => u.endsWith("/git/refs")))
        github.tags.set(ReleasePublisherTests.TAG, commit);
      return null;
    };
    return github;
  }

  private static async publishAsync(github: GitHubReleasesFixture, environment: Readonly<Record<string, string>> = {}): Promise<string> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-release-publisher-"));
    try {
      const files: ReleaseFile[] = [];
      for (const [name, bytes] of ReleasePublisherTests.FILES) {
        await writeFile(path.join(folder, name), bytes);
        files.push(new ReleaseFile(name, PackageDigest.fromBytes(bytes)));
      }
      const output = new PassThrough();
      const chunks: string[] = [];
      output.on("data", (t: Buffer) => chunks.push(t.toString()));
      const request = ReleaseRequest.read({ RELEASE_REPOSITORY: "example/sample-app", RELEASE_VERSION: "1.2.3", RELEASE_REVISION: ReleasePublisherTests.REVISION, ...environment });
      await new ReleasePublisher(new GitHubApi(request.repository, github, folder), output).publishAsync(request, folder, files, "The notes.");
      return chunks.join(String.empty);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}
