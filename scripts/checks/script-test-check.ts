/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { existsSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import type { ProcessRunner } from "../../src/noldova.desktop.build/src/services/processes/process-runner.ts";
import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";

export class ScriptTestCheck implements ICheck {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly files: readonly string[];

  public readonly title: string = Resources.scriptTestCheckTitle;

  public constructor(root: string, runner: ProcessRunner, files: readonly string[] = []) {
    this.root = root;
    this.runner = runner;
    this.files = files;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const missing = this.files.find(t => !existsSync(path.join(this.root, t)));
    if (!Object.isUndefined(missing)) {
      output.write(Resources.formatScriptTestFileMissing(missing));
      return false;
    }
    return await this.runner.runAsync(process.execPath, [...Resources.scriptTestOptions, ...(this.files.length > 0 ? this.files : Resources.scriptTestFiles)], this.root) === Resources.successExitCode;
  }
}
