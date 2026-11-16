/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile } from "node:fs/promises";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import { ProcessRunner } from "../processes/process-runner.ts";
import { GitHubRelease } from "../../models/release/github-release.ts";
import { ReleaseRequest } from "../../models/release/release-request.ts";
import { ReleaseSigning } from "../release/release-signing.ts";
import { ReleaseTag } from "../release/release-tag.ts";
import type { ReleaseVersion } from "../../models/release/release-version.ts";
import { Resources } from "../../resources.ts";
import { GitHubApi } from "../repository/github-api.ts";
import { GitHubJson } from "../repository/github-json.ts";

export class ReleaseCheck {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly command: string;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable, command: string = Resources.commandName) {
    this.root = root;
    this.runner = runner;
    this.environment = environment;
    this.output = output;
    this.command = command;
  }

  public async runAsync(checkArguments: readonly string[]): Promise<number> {
    if (checkArguments.length > 0) {
      this.output.write(Resources.formatReleaseCheckUsage(this.command));
      return Resources.usageExitCode;
    }
    try {
      await this.checkAsync();
      return 0;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      this.output.write(Resources.formatOutputLine(error.message));
      return Resources.failureExitCode;
    }
  }

  private async checkAsync(): Promise<void> {
    const request = ReleaseRequest.read(this.environment);
    const manifest = await RootManifest.readAsync(this.root);
    const product = await ProductIdentity.readAsync(this.root);
    const signed = (await ReleaseSigning.readAsync(this.root)).listSignedPlatforms(product, request.repository);
    if (manifest.productVersion !== request.version.text)
      throw new BuildException(Resources.formatRootVersionMismatch(manifest.productVersion, request.version.text));
    if (request.isSeparate && Object.isNull(product.namedUpdateFeed))
      throw new BuildException(Resources.formatSeparateReleaseNeedsFeed(request.repository, request.sourceRepository));

    const api = new GitHubApi(request.repository, this.runner, this.root);
    const source = request.isSeparate ? new GitHubApi(request.sourceRepository, this.runner, this.root) : api;
    const highest = (await api.readPagesAsync(Resources.githubReleasesPath))
      .map((t, index) => GitHubRelease.read(t, Resources.formatReleaseLabel(index)))
      .filter(t => !t.isDraft && (!request.isSeparate || request.ownsTag(t.tag)))
      .map(t => request.parseTag(t.tag, Resources.formatReleaseTagLabel(t.id)))
      .reduce<ReleaseVersion | null>((found, t) => Object.isNull(found) || t.isNewerThan(found) ? t : found, null);
    if (!Object.isNull(highest) && !request.version.isNewerThan(highest))
      throw new BuildException(Resources.formatReleaseNotNewer(request.version.text, highest.text));

    const tagged = await ReleaseTag.readCommitAsync(api, request.tag);
    if (request.isSeparate && !Object.isNull(tagged))
      throw new BuildException(Resources.formatReleaseTagTaken(request.tag, request.repository));
    ReleaseTag.requireAt(request.tag, tagged, request.revision);

    const comparison = await source.readOptionalAsync(Resources.formatCompareRoute(request.revision));
    if (Object.isNull(comparison))
      throw new BuildException(Resources.formatRevisionNotCommit(request.revision, request.sourceRepository));
    const status = GitHubJson.text(GitHubJson.object(comparison, Resources.comparisonLabel), Resources.gitHubStatusField, Resources.comparisonLabel);
    if (!Resources.onMainStatuses.includes(status))
      throw new BuildException(Resources.formatRevisionNotOnMain(request.revision, status));

    const runs = GitHubJson.children(GitHubJson.object(await source.readAsync(Resources.formatBuildRunsRoute(request.revision)), Resources.buildRunsLabel), Resources.gitHubWorkflowRunsField, Resources.buildRunsLabel);
    const run = runs.at(0);
    if (Object.isUndefined(run))
      throw new BuildException(Resources.formatNoBuildRun(request.revision));
    const conclusion = GitHubJson.nullableText(run, Resources.gitHubConclusionField, Resources.buildRunLabel) ?? GitHubJson.text(run, Resources.gitHubStatusField, Resources.buildRunLabel);
    if (conclusion !== Resources.successConclusion)
      throw new BuildException(Resources.formatBuildRunFailed(request.revision, conclusion));
    const output = this.environment[Resources.githubOutputVariable];
    if (!Object.isUndefined(output))
      await appendFile(output, Resources.formatReleaseCheckOutputs(signed, product.isReleaseRepository(request.repository) ? product.namedUpdateFeed ?? String.empty : String.empty));
    this.output.write(Resources.formatReleaseChecked(request.tag, request.repository, request.revision, signed));
  }
}
