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
import { Resources } from "../../resources.ts";

export class ChooseFeed {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly command: string;

  public constructor(environment: NodeJS.ProcessEnv, output: Writable, command: string) {
    this.environment = environment;
    this.output = output;
    this.command = command;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    if (commandArguments.length > 0) {
      this.output.write(Resources.formatChooseFeedUsage(this.command));
      return Resources.usageExitCode;
    }
    const file = this.environment[Resources.githubOutputVariable];
    if (Object.isUndefined(file) || file.length === 0)
      return this.refuse(Resources.chooseFeedNoOutputFile);
    const internal = this.read(Resources.internalFeedVariable);
    if (!Resources.internalFeedKinds.includes(internal))
      return this.refuse(Resources.formatInternalFeedKindInvalid(internal));
    const feed = this.read(Resources.updateFeedVariable);
    const version = this.read(Resources.packageVersionVariable);
    if (internal.length > 0 && (feed.length > 0 || version.length > 0))
      return this.refuse(Resources.chooseFeedInternalWithTest);
    if (internal !== Resources.internalFeedBuildKind)
      return this.writeAsync(file, feed, version);
    const internalFeed = this.read(Resources.internalFeedUrlVariable);
    if (internalFeed.length === 0)
      return this.refuse(Resources.chooseFeedNoInternalUrl);
    const signed = this.read(Resources.signingVariable).split(Resources.whitespacePattern);
    if (!Resources.internalFeedSignedTargets.every(t => signed.includes(t)))
      return this.refuse(Resources.chooseFeedNotSigned);
    const internalVersion = Resources.formatInternalVersion(this.read(Resources.releaseVersionVariable), this.read(Resources.runNumberVariable));
    if (this.read(Resources.runAttemptVariable) !== Resources.firstRunAttempt)
      return this.refuse(Resources.formatInternalFeedRerun(internalVersion));
    this.output.write(Resources.formatInternalFeedChosen(internalVersion));
    return this.writeAsync(file, internalFeed, internalVersion);
  }

  private refuse(message: string): number {
    this.output.write(Resources.formatGithubError(message));
    return Resources.failureExitCode;
  }

  private async writeAsync(file: string, feed: string, version: string): Promise<number> {
    await appendFile(file, Resources.formatFeedOutputs(feed, version));
    return 0;
  }

  private read(name: string): string {
    return this.environment[name] ?? String.empty;
  }
}
