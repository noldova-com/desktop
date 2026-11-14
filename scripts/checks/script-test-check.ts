/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessRunner } from "../../src/noldova.desktop.build/src/services/processes/process-runner.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ScriptTestCheck implements ICheck {
  private readonly root: string;
  private readonly runner: ProcessRunner;

  public readonly title: string = Resources.scriptTestCheckTitle;

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public async runAsync(): Promise<boolean> {
    return await this.runner.runAsync(process.execPath, Resources.scriptTestArguments, this.root) === Resources.successExitCode;
  }
}
