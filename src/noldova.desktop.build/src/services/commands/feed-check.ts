/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import type { IFeedFile } from "../../interfaces/i-feed-file.ts";
import type { IRetryClock } from "../../interfaces/i-retry-clock.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { UpdateFeed } from "../packages/update-feed.ts";
import { UpdateMetadata } from "../release/update-metadata.ts";
import { Resources } from "../../resources.ts";

export class FeedCheck {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly command: string;
  private readonly clock: IRetryClock;

  public constructor(environment: NodeJS.ProcessEnv, output: Writable, command: string, clock: IRetryClock) {
    this.environment = environment;
    this.output = output;
    this.command = command;
    this.clock = clock;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    if (commandArguments.length > 0) {
      this.output.write(Resources.formatFeedCheckUsage(this.command));
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
    const skip = this.read(Resources.feedSkipVariable);
    if (!Resources.feedSkipValues.includes(skip))
      throw new BuildException(Resources.formatFeedSkipInvalid(skip));
    if (skip === Resources.feedSkipValue) {
      this.output.write(Resources.feedSkipped);
      return;
    }
    const feed = this.readFeed();
    const version = this.read(Resources.feedVersionVariable);
    if (!Resources.feedVersionPattern.test(version))
      throw new BuildException(Resources.formatFeedVersionInvalid(version));
    const targets = this.readTargets();
    const deadline = this.clock.now() + this.readWaitSeconds() * Resources.millisecondsPerSecond;
    const end = deadline + Resources.feedDownloadLimit;
    for (const target of targets) {
      const name = UpdateMetadata.formatFileName(target);
      const text = await this.readUpdateInformationAsync(feed, name, version, deadline, end);
      this.output.write(Resources.formatOutputLine(await this.checkFilesAsync(feed, name, version, text, target, end)));
    }
    this.output.write(Resources.formatFeedServes(feed, version, targets.map(t => t.id)));
  }

  private async readUpdateInformationAsync(feed: string, name: string, version: string, deadline: number, end: number): Promise<string> {
    const response = await this.openAsync(feed, name, end);
    let problem: string;
    if (response.status === Resources.httpNotFoundStatus)
      problem = Resources.formatFeedHttpProblem(name, feed, response.status);
    else {
      const text = (await FeedCheck.readBodyAsync(response, feed, name)).toString(Resources.textEncoding);
      const found = Resources.feedVersionLinePattern.exec(text)?.[1] ?? String.empty;
      if (found === version)
        return text;
      problem = Resources.formatFeedVersionMismatch(name, feed, found, version);
    }
    const remaining = deadline - this.clock.now();
    if (remaining <= 0)
      throw new BuildException(problem);
    this.output.write(Resources.formatFeedCatchingUp(problem));
    await this.clock.pauseAsync(Math.min(Resources.feedRetryInterval, remaining));
    return this.readUpdateInformationAsync(feed, name, version, deadline, end);
  }

  private async checkFilesAsync(feed: string, metadata: string, version: string, text: string, target: PackageTarget, end: number): Promise<string> {
    const files: IFeedFile[] = [...text.matchAll(Resources.feedFileEntryPattern)].map(t => ({ name: FeedCheck.unquote(String(t[1])), sha512: String(t[2]), size: Number(t[3]) }));
    if (files.length === 0)
      throw new BuildException(Resources.formatFeedListsNoFiles(metadata, feed));
    if (files.length !== [...text.matchAll(Resources.feedEntryStartPattern)].length)
      throw new BuildException(Resources.formatFeedFileIncomplete(metadata, feed));
    for (const file of files) {
      const bytes = await FeedCheck.readBodyAsync(await this.openAsync(feed, file.name, end), feed, file.name);
      const sha512 = createHash(Resources.feedFileHash).update(bytes).digest(Resources.feedFileDigest);
      if (sha512 !== file.sha512)
        throw new BuildException(Resources.formatFeedHashMismatch(file.name, feed, sha512, metadata, file.sha512));
      if (bytes.length !== file.size)
        throw new BuildException(Resources.formatFeedSizeMismatch(file.name, feed, bytes.length, metadata, file.size));
    }
    return Resources.formatFeedFilesMatch(target.id, metadata, version, files.map(t => t.name));
  }

  private async openAsync(feed: string, name: string, end: number): Promise<Response> {
    const origin = new URL(feed).origin;
    let url = new URL(name, feed);
    for (let hop = 0; hop <= Resources.feedMaximumRedirects; hop += 1) {
      const response = await FeedCheck.requestAsync(url, feed, name, Math.max(Resources.feedMinimumRequestTimeout, end - this.clock.now()));
      const location = response.headers.get(Resources.locationHeader);
      if (!Resources.redirectStatuses.includes(response.status) || Object.isNull(location)) {
        if (response.ok && (response.headers.get(Resources.contentTypeHeader) ?? String.empty).startsWith(Resources.webPageContentType))
          throw new BuildException(Resources.formatFeedWebPage(name, feed, url.origin, url.pathname));
        if (!response.ok && response.status !== Resources.httpNotFoundStatus)
          throw new BuildException(Resources.formatFeedHttpProblem(name, feed, response.status));
        return response;
      }
      await response.body?.cancel();
      url = new URL(location, url);
      if (url.origin !== origin && !Resources.releaseAssetOrigins.includes(url.origin))
        throw new BuildException(Resources.formatFeedRedirectedAway(name, feed, url.origin));
    }
    throw new BuildException(Resources.formatFeedTooManyRedirects(name, feed));
  }

  private readFeed(): string {
    const feed = this.read(Resources.feedUrlVariable);
    if (feed.length > 0) {
      if (URL.canParse(feed)) {
        const url = new URL(feed);
        if ([url.username, url.password, url.search, url.hash].some(t => t.length > 0))
          throw new BuildException(Resources.feedUrlCarriesSecret);
      }
      if (!UpdateFeed.isValid(feed))
        throw new BuildException(Resources.formatFeedUrlInvalid(feed));
      return feed;
    }
    const repository = this.read(Resources.releaseRepositoryVariable);
    if (!Resources.releaseRepositoryPattern.test(repository))
      throw new BuildException(Resources.formatFeedRepositoryInvalid(repository));
    return UpdateFeed.ofRepository(repository);
  }

  private readTargets(): readonly PackageTarget[] {
    const all = PackageTarget.listAll();
    const text = this.read(Resources.releaseTargetsVariable);
    const ids = text.split(Resources.commaSeparator);
    if (text.length === 0 || new Set(ids).size !== ids.length || !ids.every(t => all.some(u => u.id === t)))
      throw new BuildException(Resources.formatFeedTargetsInvalid(all.map(t => t.id), text));
    return all.filter(t => ids.includes(t.id)).sort((first, second) => ids.indexOf(first.id) - ids.indexOf(second.id));
  }

  private readWaitSeconds(): number {
    const text = this.read(Resources.feedWaitVariable);
    if (text.length === 0)
      return Resources.feedDefaultWaitSeconds;
    const seconds = Number(text);
    if (!Resources.feedWaitPattern.test(text) || seconds > Resources.feedMaximumWaitSeconds)
      throw new BuildException(Resources.formatFeedWaitInvalid(text));
    return seconds;
  }

  private read(name: string): string {
    return this.environment[name] ?? String.empty;
  }

  private static async requestAsync(url: URL, feed: string, name: string, limit: number): Promise<Response> {
    try {
      return await fetch(url, { redirect: Resources.feedRedirectMode, signal: AbortSignal.timeout(limit) });
    }
    catch (error) {
      throw new BuildException(Resources.formatFeedReadFailed(name, feed, error), new ExceptionOptions(error));
    }
  }

  private static async readBodyAsync(response: Response, feed: string, name: string): Promise<Buffer> {
    if (!response.ok)
      throw new BuildException(Resources.formatFeedHttpProblem(name, feed, response.status));
    try {
      return Buffer.from(await response.arrayBuffer());
    }
    catch (error) {
      throw new BuildException(Resources.formatFeedReadFailed(name, feed, error), new ExceptionOptions(error));
    }
  }

  private static unquote(text: string): string {
    const quoted = Resources.yamlQuotedPattern.exec(text);
    return Object.isNull(quoted) ? text : String(quoted[1]).replaceAll(Resources.yamlEscapedQuote, Resources.yamlQuote);
  }
}
