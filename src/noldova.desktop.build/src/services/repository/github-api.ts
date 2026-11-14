/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { ExecutableLocator } from "../processes/executable-locator.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { GitHubRequestException } from "../../exceptions/github-request.exception.ts";
import { GitHubJson } from "./github-json.ts";
import { Resources } from "../../resources.ts";

export class GitHubApi {
  private readonly repository: string;
  private readonly runner: ProcessRunner;
  private readonly directory: string;
  private readonly executable: string;

  public constructor(repository: string, runner: ProcessRunner, directory: string) {
    this.repository = repository;
    this.runner = runner;
    this.directory = directory;
    this.executable = ExecutableLocator.locate(Resources.githubCommand);
  }

  public async readAsync(resource: string): Promise<unknown> {
    return this.parse(await this.captureAsync([Resources.ghApiCommand, this.locate(resource)]), resource);
  }

  public async readPagesAsync(resource: string): Promise<readonly unknown[]> {
    const pages = this.parse(await this.captureAsync([Resources.ghApiCommand, Resources.ghPaginateOption, Resources.ghSlurpOption, this.locate(resource)]), resource);
    return GitHubJson.array(pages, resource).flatMap(t => GitHubJson.array(t, resource));
  }

  public async readTagAsync(tag: string): Promise<Readonly<Record<string, unknown>> | null> {
    const context = Resources.formatTagReferencesContext(tag);
    const reference = Resources.formatTagReference(tag);
    return GitHubJson.array(await this.readAsync(Resources.formatGitHubTagReferencesPath(tag)), context)
      .map(t => GitHubJson.object(t, context))
      .find(t => GitHubJson.text(t, Resources.githubRefField, context) === reference) ?? null;
  }

  public async readOptionalAsync(resource: string): Promise<unknown> {
    try {
      return await this.readAsync(resource);
    }
    catch (error) {
      if (error instanceof GitHubRequestException && error.status === Resources.httpNotFoundStatus)
        return null;
      throw error;
    }
  }

  public async writeAsync(method: string, resource: string, body: string): Promise<void> {
    await this.captureAsync(this.formatRequest(method, resource, [[Resources.githubBodyField, body]], []));
  }

  public createAsync(resource: string, fields: readonly (readonly [string, string])[]): Promise<unknown> {
    return this.sendAsync(Resources.httpPostMethod, resource, fields, []);
  }

  public async postAsync(resource: string): Promise<void> {
    await this.captureAsync(this.formatRequest(Resources.httpPostMethod, resource, [], []));
  }

  public async sendAsync(method: string, resource: string, texts: readonly (readonly [string, string])[], flags: readonly (readonly [string, boolean | number])[]): Promise<unknown> {
    return this.parse(await this.captureAsync(this.formatRequest(method, resource, texts, flags)), resource);
  }

  public async deleteAsync(resource: string): Promise<void> {
    await this.captureAsync(this.formatRequest(Resources.httpDeleteMethod, resource, [], []));
  }

  public async uploadAsync(tag: string, file: string): Promise<void> {
    await this.captureAsync([Resources.ghReleaseCommand, Resources.ghUploadCommand, tag, file, Resources.ghRepoOption, this.repository], Resources.githubUploadTimeout);
  }

  private formatRequest(method: string, resource: string, texts: readonly (readonly [string, string])[], flags: readonly (readonly [string, boolean | number])[]): readonly string[] {
    return [Resources.ghApiCommand, Resources.ghMethodOption, method, this.locate(resource), ...texts.flatMap(([name, value]) => [Resources.ghRawFieldOption, Resources.formatGhField(name, value)]),
      ...flags.flatMap(([name, value]) => [Resources.ghFieldOption, Resources.formatGhField(name, value)])];
  }

  private locate(resource: string): string {
    return Resources.formatGitHubRepositoryPath(this.repository, resource);
  }

  private parse(output: string, resource: string): unknown {
    try {
      return JsonReader.parseValue(output);
    }
    catch (error) {
      throw new BuildException(Resources.formatGitHubNotJson(resource), new ExceptionOptions(error));
    }
  }

  private async captureAsync(gitHubArguments: readonly string[], timeout: number = Resources.githubTimeout): Promise<string> {
    const result = await this.runner.captureAsync(this.executable, gitHubArguments, this.directory, timeout);
    if (!result.isSuccessful) {
      const status = Resources.githubStatusPattern.exec(result.errorOutput);
      throw new GitHubRequestException(gitHubArguments, result.exitCode, result.errorOutput, Object.isNull(status) ? null : Number(status[1]));
    }
    return result.output;
  }
}
