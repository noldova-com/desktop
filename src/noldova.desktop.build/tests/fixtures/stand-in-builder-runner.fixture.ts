/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProcessResult } from "../../src/models/processes/process-result.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";

export class StandInBuilderRunnerFixture extends ProcessRunner {
  private readonly runner: ProcessRunner;
  private readonly files: readonly string[];

  public readonly environments: NodeJS.ProcessEnv[] = [];

  public constructor(runner: ProcessRunner, files: readonly string[]) {
    super();
    this.runner = runner;
    this.files = files;
  }

  public override captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    return this.runner.captureAsync(command, commandArguments, directory, timeout, environment);
  }

  public override async runAsync(_command: string, _commandArguments: readonly string[], _directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    this.environments.push(environment ?? {});
    for (const file of this.files) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, String.empty);
    }
    return 0;
  }
}
