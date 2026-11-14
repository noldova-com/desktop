/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";

import type { ProcessResult } from "../../models/processes/process-result.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class NodeGyp {
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.environment = environment;
  }

  public async runAsync(nodeGypArguments: readonly string[], directory: string): Promise<ProcessResult> {
    const npm = this.environment[Resources.npmExecPathVariable];
    if (Object.isUndefined(npm) || npm.length === 0)
      throw new BuildException(Resources.npmUnavailable);
    return this.runner.captureAsync(process.execPath, [path.join(path.dirname(npm), ...Resources.nodeGypScriptSegments), ...nodeGypArguments], directory, Resources.nodeGypTimeout);
  }
}
