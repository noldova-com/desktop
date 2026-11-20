/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ProcessResult } from "../../src/models/processes/process-result.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";

export class RecordingRunnerFixture extends ProcessRunner {
  private readonly results: readonly ProcessResult[];
  private readonly effectAsync: (directory: string) => Promise<void>;

  public readonly calls: (readonly string[])[] = [];

  public constructor(result: ProcessResult | readonly ProcessResult[] = new ProcessResult(0, "done", ""), effectAsync: (directory: string) => Promise<void> = () => Promise.resolve()) {
    super();
    this.results = result instanceof ProcessResult ? [result] : result;
    this.effectAsync = effectAsync;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number): Promise<ProcessResult> {
    this.calls.push([command, ...commandArguments, directory, String(timeout)]);
    await this.effectAsync(directory);
    return this.results[Math.min(this.calls.length, this.results.length) - 1] ?? new ProcessResult(0, "done", "");
  }
}
