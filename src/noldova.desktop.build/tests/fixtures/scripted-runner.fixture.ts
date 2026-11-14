/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";

import { ProcessResult } from "../../src/models/processes/process-result.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";

export class ScriptedRunnerFixture extends ProcessRunner {
  public static readonly SUCCESS: ProcessResult = new ProcessResult(0, String.empty, String.empty);

  private readonly answer: (command: string, commandArguments: readonly string[]) => ProcessResult | Promise<ProcessResult>;
  private readonly exitCode: number | null;

  public readonly captured: string[] = [];
  public readonly ran: string[] = [];
  public readonly environments: NodeJS.ProcessEnv[] = [];
  public readonly folders: string[] = [];

  public constructor(answer: (command: string, commandArguments: readonly string[]) => ProcessResult | Promise<ProcessResult> = () => ScriptedRunnerFixture.SUCCESS,
    exitCode: number | null = 0) {
    super();
    this.answer = answer;
    this.exitCode = exitCode;
  }

  public static format(command: string, commandArguments: readonly string[]): string {
    return [path.basename(command), ...commandArguments].join(" ");
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, _timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    this.captured.push(ScriptedRunnerFixture.format(command, commandArguments));
    this.folders.push(directory);
    if (!Object.isUndefined(environment))
      this.environments.push(environment);
    return await this.answer(command, commandArguments);
  }

  public override runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv): Promise<number | null> {
    this.ran.push(ScriptedRunnerFixture.format(command, commandArguments));
    this.folders.push(directory);
    if (!Object.isUndefined(environment))
      this.environments.push(environment);
    return Promise.resolve(this.exitCode);
  }
}
