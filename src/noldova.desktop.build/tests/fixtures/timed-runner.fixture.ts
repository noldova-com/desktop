/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ProcessTimeoutException } from "../../src/exceptions/process-timeout.exception.js";
import { ProcessResult } from "../../src/models/processes/process-result.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";
import type { StartedProcess } from "../../src/services/processes/started-process.js";

export class TimedRunnerFixture extends ProcessRunner {
  private readonly duration: number;

  public readonly timeouts: (number | undefined)[] = [];
  public readonly calls: string[] = [];

  public constructor(duration: number) {
    super();
    this.duration = duration;
  }

  public override captureAsync(command: string, _commandArguments: readonly string[], _directory: string, timeout: number): Promise<ProcessResult> {
    this.timeouts.push(timeout);
    return timeout < this.duration ? Promise.reject(new ProcessTimeoutException(command, timeout)) : Promise.resolve(new ProcessResult(0, String.empty, String.empty));
  }

  public override runAsync(command: string, _commandArguments: readonly string[], _directory: string, _environment?: NodeJS.ProcessEnv, _watch?: (text: string) => void,
    timeout?: number): Promise<number | null> {
    this.timeouts.push(timeout);
    return !Object.isUndefined(timeout) && timeout < this.duration ? Promise.reject(new ProcessTimeoutException(command, timeout)) : Promise.resolve(0);
  }

  public override startAsync(command: string): Promise<StartedProcess> {
    this.calls.push(`start ${command}`);
    return Promise.reject(new Error(command));
  }

  public override isRunning(processId: number): boolean {
    this.calls.push(`running ${processId}`);
    return true;
  }

  public override kill(processId: number): void {
    this.calls.push(`kill ${processId}`);
  }
}
