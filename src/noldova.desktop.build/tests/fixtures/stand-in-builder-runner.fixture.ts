/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProcessResult } from "../../src/models/processes/process-result.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";
import { FolderFixture } from "./folder.fixture.js";

export class StandInBuilderRunnerFixture extends ProcessRunner {
  private readonly runner: ProcessRunner;
  private readonly files: readonly string[];
  private readonly failures: string[];
  private readonly built: ReadonlyMap<string, Buffer>;

  public readonly environments: NodeJS.ProcessEnv[] = [];
  public readonly calls: (readonly string[])[] = [];

  public constructor(runner: ProcessRunner, files: readonly string[], failures: readonly string[] = [], built: ReadonlyMap<string, Buffer> = new Map()) {
    super();
    this.runner = runner;
    this.files = files;
    this.failures = [...failures];
    this.built = built;
  }

  public override captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    return this.runner.captureAsync(command, commandArguments, directory, timeout, environment);
  }

  public override async runAsync(_command: string, commandArguments: readonly string[], _directory: string, environment?: NodeJS.ProcessEnv, watch?: (text: string) => void):
    Promise<number | null> {
    this.environments.push(environment ?? {});
    this.calls.push(commandArguments);
    const failure = this.failures.shift();
    if (!Object.isUndefined(failure)) {
      const middle = Math.floor(failure.length / 2);
      watch?.(failure.slice(0, middle));
      watch?.(failure.slice(middle));
      return 1;
    }
    for (const file of this.files) {
      await FolderFixture.ensureAsync(path.dirname(file));
      await writeFile(file, String.empty);
    }
    for (const [file, data] of this.built) {
      await FolderFixture.ensureAsync(path.dirname(file));
      await writeFile(file, data);
    }
    return 0;
  }
}
