/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import type { ProcessRunner } from "../processes/process-runner.ts";
import { Resources } from "../../resources.ts";
import { RetriedDownload } from "../processes/retried-download.ts";

export class ElectronBinary {
  private readonly directory: string;
  private readonly root: string;
  private readonly runner: ProcessRunner;

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.directory = path.join(root, ...Resources.electronPackageSegments);
    this.runner = runner;
  }

  public isInstalled(): boolean {
    const pathFile = path.join(this.directory, Resources.electronPathFile);
    return existsSync(pathFile) && existsSync(path.join(this.directory, Resources.electronDistributionFolder, readFileSync(pathFile, Resources.textEncoding)));
  }

  public async installAsync(output: Writable): Promise<void> {
    const installer = path.join(this.directory, Resources.electronInstallerFile);
    if (!existsSync(installer) || this.isInstalled())
      return;

    output.write(Resources.electronInstalling);
    await RetriedDownload.runAsync(Resources.electronSubject, output, async () => {
      const result = await this.runner.captureAsync(process.execPath, [installer], this.root, Resources.downloadAttemptTimeout);
      if (result.isSuccessful && this.isInstalled())
        return null;
      return result.isSuccessful ? Resources.electronStillMissing : Resources.formatExitCodeProblem(result.exitCode, result.errorOutput);
    });
  }
}
