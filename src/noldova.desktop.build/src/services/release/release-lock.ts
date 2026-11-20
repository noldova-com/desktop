/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import type { Writable } from "node:stream";

import "@noldova/context.core";

import { GitHubRequestException } from "../../exceptions/github-request.exception.ts";
import type { IReleaseLockHolder } from "../../interfaces/i-release-lock-holder.ts";
import type { IRetryClock } from "../../interfaces/i-retry-clock.ts";
import { Resources } from "../../resources.ts";
import { GitHubJson } from "../repository/github-json.ts";
import type { GitHubApi } from "../repository/github-api.ts";

export class ReleaseLock {
  private readonly api: GitHubApi;
  private readonly repository: string;
  private readonly output: Writable;
  private readonly clock: IRetryClock;

  public constructor(api: GitHubApi, repository: string, output: Writable, clock: IRetryClock) {
    this.api = api;
    this.repository = repository;
    this.output = output;
    this.clock = clock;
  }

  public async takeAsync(run: string, revision: string): Promise<void> {
    let awaited: string | null = null;
    for (;;) {
      const holder = await this.readHolderAsync();
      if (Object.isNull(holder)) {
        const commit = await this.createCommitAsync(run, revision);
        if (await this.tryAsync(Resources.httpPostMethod, Resources.githubReferencesPath, [[Resources.githubRefField, Resources.releaseLockReference], [Resources.githubShaField, commit]], [])) {
          this.output.write(Resources.formatReleaseLockTaken(this.repository, run));
          return;
        }
      }
      else if (holder.run === run || await this.hasEndedAsync(holder.run)) {
        const commit = await this.createCommitAsync(run, holder.commit);
        if (await this.tryAsync(Resources.httpPatchMethod, Resources.releaseLockPath, [[Resources.githubShaField, commit]], [[Resources.githubForceField, false]])) {
          this.output.write(holder.run === run ? Resources.formatReleaseLockTakenAgain(this.repository, run) : Resources.formatReleaseLockBroken(this.repository, run, holder.run));
          return;
        }
      }
      else {
        if (awaited !== holder.run)
          this.output.write(Resources.formatReleaseLockWaiting(this.repository, holder.run));
        awaited = holder.run;
        await this.clock.pauseAsync(Resources.releaseLockRetryInterval);
      }
    }
  }

  public async letGoAsync(run: string): Promise<void> {
    const holder = await this.readHolderAsync();
    if (Object.isNull(holder))
      this.output.write(Resources.formatReleaseLockFree(this.repository));
    else if (holder.run !== run)
      this.output.write(Resources.formatReleaseLockHeldByAnother(this.repository, run, holder.run));
    else {
      await this.api.deleteAsync(Resources.releaseLockPath);
      this.output.write(Resources.formatReleaseLockLetGo(this.repository, run));
    }
  }

  private async readHolderAsync(): Promise<IReleaseLockHolder | null> {
    const reference = await this.api.readOptionalAsync(Resources.releaseLockReadPath);
    if (Object.isNull(reference))
      return null;
    const commit = GitHubJson.text(GitHubJson.child(GitHubJson.object(reference, Resources.releaseLockContext), Resources.githubObjectField, Resources.releaseLockContext),
      Resources.githubShaField, Resources.releaseLockContext);
    const message = GitHubJson.text(GitHubJson.object(await this.api.readAsync(Resources.formatGitHubCommitPath(commit)), Resources.releaseLockContext),
      Resources.githubMessageField, Resources.releaseLockContext);
    return { commit, run: Resources.releaseLockMessagePattern.exec(message)?.[1] ?? null };
  }

  private async hasEndedAsync(run: string | null): Promise<boolean> {
    if (Object.isNull(run))
      return true;
    const answer = await this.api.readOptionalAsync(Resources.formatGitHubRunPath(run));
    return Object.isNull(answer) || GitHubJson.text(GitHubJson.object(answer, Resources.releaseLockRunContext), Resources.githubStatusField, Resources.releaseLockRunContext) === Resources.githubCompletedStatus;
  }

  private async createCommitAsync(run: string, parent: string): Promise<string> {
    const tree = GitHubJson.text(GitHubJson.child(GitHubJson.object(await this.api.readAsync(Resources.formatGitHubCommitPath(parent)), Resources.releaseLockContext),
      Resources.githubTreeField, Resources.releaseLockContext), Resources.githubShaField, Resources.releaseLockContext);
    const commit = await this.api.sendAsync(Resources.httpPostMethod, Resources.githubCommitsPath,
      [[Resources.githubMessageField, Resources.formatReleaseLockMessage(run)], [Resources.githubTreeField, tree], [Resources.githubParentsField, parent]], []);
    return GitHubJson.text(GitHubJson.object(commit, Resources.releaseLockContext), Resources.githubShaField, Resources.releaseLockContext);
  }

  private async tryAsync(method: string, resource: string, texts: readonly (readonly [string, string])[], flags: readonly (readonly [string, boolean])[]): Promise<boolean> {
    try {
      await this.api.sendAsync(method, resource, texts, flags);
      return true;
    }
    catch (error) {
      if (error instanceof GitHubRequestException && error.status === Resources.githubExistingReferenceStatus)
        return false;
      throw error;
    }
  }
}
