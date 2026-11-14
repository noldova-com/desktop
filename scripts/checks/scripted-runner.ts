/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessResult } from "../../src/noldova.desktop.build/src/models/processes/process-result.ts";
import { ProcessRunner } from "../../src/noldova.desktop.build/src/services/processes/process-runner.ts";

export class ScriptedRunner extends ProcessRunner {
  private readonly result: ProcessResult;

  public readonly calls: (readonly string[])[] = [];

  public constructor(result: ProcessResult) {
    super();
    this.result = result;
  }

  public override captureAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    this.calls.push([command, ...commandArguments]);
    return Promise.resolve(this.result);
  }
}
