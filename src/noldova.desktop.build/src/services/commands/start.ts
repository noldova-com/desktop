/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/context.core";

import { ProcessRunner } from "../processes/process-runner.ts";
import { DevelopmentBinary } from "../desktop/development-binary.ts";
import { SandboxValidator } from "../desktop/sandbox.validator.ts";
import { Resources } from "../../resources.ts";

export class Start {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly binary: DevelopmentBinary;
  private readonly sandbox: SandboxValidator;

  public constructor(root: string, runner: ProcessRunner, binary: DevelopmentBinary, sandbox: SandboxValidator) {
    this.root = root;
    this.runner = runner;
    this.binary = binary;
    this.sandbox = sandbox;
  }

  public async runAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv, report: Writable): Promise<number> {
    const executable = await this.binary.prepareAsync(report);
    const problem = await this.sandbox.findProblemAsync(executable);
    if (!Object.isNull(problem)) {
      report.write(problem);
      return Resources.failureExitCode;
    }
    const launched = Object.fromEntries(Object.entries(environment).filter(([name]) => name !== Resources.runAsNodeVariable));
    const exitCode = await this.runner.runAsync(executable, [this.binary.packageFolder, ...commandArguments], this.root, launched);
    return exitCode ?? Resources.failureExitCode;
  }
}
