/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";
import timers from "node:timers/promises";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import type { GitHubApi } from "../repository/github-api.ts";
import { ProcessTimeoutException } from "../../exceptions/process-timeout.exception.ts";
import { GitHubRequestException } from "../../exceptions/github-request.exception.ts";
import { GitHubRelease } from "../../models/release/github-release.ts";
import type { GitHubReleaseAsset } from "../../models/release/github-release-asset.ts";
import type { PackageDigest } from "../../models/release/package-digest.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import type { ReleaseFile } from "../../models/release/release-file.ts";
import { ReleaseTag } from "./release-tag.ts";
import type { ReleaseRequest } from "../../models/release/release-request.ts";
import { Resources } from "../../resources.ts";

export class ReleasePublisher {
  private readonly api: GitHubApi;
  private readonly output: Writable;

  public constructor(api: GitHubApi, output: Writable) {
    this.api = api;
    this.output = output;
  }

  public async publishAsync(request: ReleaseRequest, folder: string, files: readonly ReleaseFile[], notes: string): Promise<void> {
    const { tag, revision } = request;
    const digests = new Map(files.map(t => [t.name, t.digest]));
    const releases = (await this.api.readPagesAsync(Resources.githubReleasesPath)).map((t, index) => GitHubRelease.read(t, Resources.formatGitHubReleasesContext(index))).filter(t => t.tag === tag);
    if (releases.length > 1)
      throw new BuildException(Resources.formatReleaseTagShared(releases.length, tag));
    const existing = releases.at(0);
    if (!Object.isUndefined(existing) && !existing.isDraft) {
      ReleasePublisher.requireComplete(existing, digests);
      await this.requireTagAsync(request);
      this.output.write(Resources.formatReleaseAlreadyPublished(tag));
      return;
    }

    const draft = existing ?? await this.createDraftAsync(request, notes);
    if (!request.isSeparate && draft.target !== revision)
      throw new BuildException(Resources.formatDraftForOtherRevision(tag, draft.target, revision));
    for (const [name, digest] of digests)
      await this.uploadAsync(draft, name, path.join(folder, name), digest);
    ReleasePublisher.requireComplete(await this.readAsync(draft.id), digests);
    if (!request.isSeparate)
      await this.createTagAsync(tag, revision);
    const published = GitHubRelease.read(await this.api.sendAsync(Resources.httpPatchMethod, Resources.formatGitHubReleasePath(draft.id), [[Resources.githubMakeLatestField, Resources.releaseMakeLatestValue]], [[Resources.githubDraftField, false]]),
      Resources.publishedReleaseContext);
    if (published.isDraft)
      throw new BuildException(Resources.formatReleaseKeptDraft(tag));
    try {
      ReleasePublisher.requireComplete(published, digests);
      await this.requireTagAsync(request);
    }
    catch (error) {
      throw new BuildException(Resources.formatReleaseCheckFailed(tag, String(error)),
        new ExceptionOptions(error));
    }
    this.output.write(Resources.formatReleasePublished(tag, revision, digests.size));
  }

  private static isTransient(error: unknown): error is GitHubRequestException | ProcessTimeoutException {
    return error instanceof ProcessTimeoutException || (error instanceof GitHubRequestException
      && (Object.isNull(error.status) || error.status >= Resources.httpServerErrorStatus || Resources.githubRetriedStatuses.includes(error.status)));
  }

  private static requireSame(asset: GitHubReleaseAsset, digest: PackageDigest): void {
    const expected = Resources.formatAssetDigest(digest.sha256);
    if (asset.digest !== expected || asset.size !== digest.size)
      throw new BuildException(Resources.formatAssetMismatch(asset.name, asset.size, asset.digest, digest.size, expected));
  }

  private static requireComplete(release: GitHubRelease, digests: ReadonlyMap<string, PackageDigest>): void {
    const missing: string[] = [];
    for (const [name, digest] of digests) {
      const asset = release.assets.find(t => t.name === name);
      if (Object.isUndefined(asset) || !asset.isUploaded)
        missing.push(name);
      else
        ReleasePublisher.requireSame(asset, digest);
    }
    const unexpected = release.assets.filter(t => !digests.has(t.name)).map(t => t.name);
    if (missing.length > 0 || unexpected.length > 0)
      throw new BuildException(Resources.formatReleaseAssetsDiffer(release.tag, missing, unexpected));
  }

  private async createDraftAsync(request: ReleaseRequest, notes: string): Promise<GitHubRelease> {
    const tagged = await ReleaseTag.readCommitAsync(this.api, request.tag);
    if (request.isSeparate && !Object.isNull(tagged))
      throw new BuildException(Resources.formatReleaseTagTaken(request.tag, request.repository));
    ReleaseTag.requireAt(request.tag, tagged, request.revision);
    this.output.write(Resources.formatDraftCreating(request.tag, request.revision));
    const target: readonly (readonly [string, string])[] = request.isSeparate ? [] : [[Resources.githubTargetCommitishField, request.revision]];
    return GitHubRelease.read(await this.api.sendAsync(Resources.httpPostMethod, Resources.githubReleasesPath,
      [[Resources.githubTagNameField, request.tag], ...target, [Resources.githubNameField, request.isSeparate ? request.tag : request.version.text], [Resources.githubBodyField, notes]],
      [[Resources.githubDraftField, true]]), Resources.newReleaseContext);
  }

  private async uploadAsync(release: GitHubRelease, name: string, file: string, digest: PackageDigest): Promise<void> {
    for (let attempt = 1; attempt <= Resources.releaseUploadAttempts; attempt++) {
      if (await this.isUploadedAsync(release.id, name, digest))
        return;
      try {
        await this.api.uploadAsync(release.tag, file);
      }
      catch (error) {
        if (!ReleasePublisher.isTransient(error))
          throw error;
        this.output.write(Resources.formatUploadRetry(name, attempt, error.message));
        await timers.setTimeout(Resources.releaseRetryPause);
      }
    }
    if (!await this.isUploadedAsync(release.id, name, digest))
      throw new BuildException(Resources.formatUploadFailed(name));
  }

  private async isUploadedAsync(id: number, name: string, digest: PackageDigest): Promise<boolean> {
    const asset = (await this.readAsync(id)).assets.find(t => t.name === name);
    if (Object.isUndefined(asset))
      return false;
    if (!asset.isUploaded) {
      this.output.write(Resources.formatIncompleteUploadDeleting(name));
      await this.api.deleteAsync(Resources.formatGitHubAssetPath(asset.id));
      return false;
    }
    ReleasePublisher.requireSame(asset, digest);
    return true;
  }

  private async readAsync(id: number): Promise<GitHubRelease> {
    return GitHubRelease.read(await this.api.readAsync(Resources.formatGitHubReleasePath(id)), Resources.formatGitHubReleaseContext(id));
  }

  private async createTagAsync(tag: string, revision: string): Promise<void> {
    try {
      await this.api.createAsync(Resources.githubReferencesPath, [[Resources.githubRefField, Resources.formatTagReference(tag)], [Resources.githubShaField, revision]]);
    }
    catch (error) {
      if (!(error instanceof GitHubRequestException && error.status === Resources.githubExistingReferenceStatus))
        throw error;
      const commit = await ReleaseTag.readCommitAsync(this.api, tag);
      if (Object.isNull(commit))
        throw error;
      if (commit !== revision)
        throw new BuildException(Resources.formatTagAppearedElsewhere(tag, commit, revision));
    }
  }

  private async requireTagAsync(request: ReleaseRequest): Promise<void> {
    const commit = await ReleaseTag.readCommitAsync(this.api, request.tag);
    if (request.isSeparate && Object.isNull(commit))
      throw new BuildException(Resources.formatReleaseTagMissing(request.tag, request.repository));
    if (!request.isSeparate && commit !== request.revision)
      throw new BuildException(Resources.formatTagPointsElsewhere(request.tag, commit, request.revision));
  }
}
