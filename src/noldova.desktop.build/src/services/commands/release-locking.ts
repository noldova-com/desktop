/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import type { Writable } from "node:stream";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { IRetryClock } from "../../interfaces/i-retry-clock.ts";
import { Resources } from "../../resources.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { ReleaseLock } from "../release/release-lock.ts";
import { GitHubApi } from "../repository/github-api.ts";

export class ReleaseLocking {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly command: string;
  private readonly clock: IRetryClock;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable, command: string, clock: IRetryClock) {
    this.root = root;
    this.runner = runner;
    this.environment = environment;
    this.output = output;
    this.command = command;
    this.clock = clock;
  }

  public async runAsync(name: string, lockArguments: readonly string[]): Promise<number> {
    const isTaking = name === Resources.releaseLockCommand;
    if (lockArguments.length > 0) {
      this.output.write(isTaking ? Resources.formatReleaseLockUsage(this.command) : Resources.formatReleaseUnlockUsage(this.command));
      return Resources.usageExitCode;
    }
    try {
      const repository = this.read(Resources.releaseBuildRepositoryVariable, Resources.releaseRepositoryPattern);
      const run = this.read(Resources.releaseLockRunVariable, Resources.releaseLockRunPattern);
      const lock = new ReleaseLock(new GitHubApi(repository, this.runner, this.root), repository, this.output, this.clock);
      if (isTaking)
        await lock.takeAsync(run, this.read(Resources.releaseLockRevisionVariable, Resources.releaseRevisionPattern));
      else
        await lock.letGoAsync(run);
      return 0;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      this.output.write(Resources.formatOutputLine(error.message));
      return Resources.failureExitCode;
    }
  }

  private read(variable: string, pattern: RegExp): string {
    const value = this.environment[variable] ?? String.empty;
    if (!pattern.test(value))
      throw new BuildException(Resources.formatReleaseLockVariableInvalid(variable, value));
    return value;
  }
}
