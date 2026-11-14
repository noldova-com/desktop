#!/usr/bin/env node
/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";
import { setTimeout } from "node:timers/promises";

import { Resources } from "../resources.ts";
import { ChooseFeed } from "./commands/choose-feed.ts";
import { NoldovaDesktopRange } from "./commands/noldova-desktop-range.ts";
import { FeedCheck } from "./commands/feed-check.ts";
import { ListTargets } from "./commands/list-targets.ts";
import { ModuleRange } from "./commands/module-range.ts";
import { ReleaseCheck } from "./commands/release-check.ts";
import { ReleasePublish } from "./commands/release-publish.ts";
import { ProcessRunner } from "./processes/process-runner.ts";

export class ReleaseCommandLine {
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly errors: Writable;

  public constructor(folder: string, environment: NodeJS.ProcessEnv, output: Writable, errors: Writable) {
    this.folder = folder;
    this.environment = environment;
    this.output = output;
    this.errors = errors;
  }

  public async runAsync(commandArguments: readonly string[]): Promise<number> {
    const [command, ...rest] = commandArguments;
    switch (command) {
      case Resources.listTargetsCommand:
        return new ListTargets(this.output, this.errors, this.environment, Resources.releaseCommandName).runAsync(rest);
      case Resources.releaseCheckCommand:
        return new ReleaseCheck(this.folder, new ProcessRunner(), this.environment, this.output, Resources.releaseCommandName).runAsync(rest);
      case Resources.chooseFeedCommand:
        return new ChooseFeed(this.environment, this.output, Resources.releaseCommandName).runAsync(rest);
      case Resources.releasePublishCommand:
        return new ReleasePublish(this.folder, new ProcessRunner(), this.environment, this.output, Resources.releaseCommandName).runAsync(rest);
      case Resources.feedCheckCommand:
        return new FeedCheck(this.environment, this.output, Resources.releaseCommandName, { now: () => Date.now(), pauseAsync: t => setTimeout(t) }).runAsync(rest);
      case Resources.moduleRangeCommand:
        return new ModuleRange(this.folder, this.environment, this.output, Resources.releaseCommandName).runAsync(rest);
      case Resources.noldovaDesktopRangeCommand:
        return new NoldovaDesktopRange(this.output, Resources.releaseCommandName).runAsync(rest);
      default:
        this.errors.write(Resources.releaseUsage);
        return Resources.usageExitCode;
    }
  }
}

if (import.meta.main)
  process.exitCode = await new ReleaseCommandLine(process.cwd(), process.env, process.stdout, process.stderr).runAsync(process.argv.slice(Resources.commandArgumentsOffset));
