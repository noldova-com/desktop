/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessRunner } from "../processes/process-runner.ts";
import { Resources } from "../../resources.ts";

export class FileHolders {
  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
  }

  public async describeAsync(files: readonly string[]): Promise<string> {
    const command = Buffer.from(Resources.fileHoldersScript, Resources.powershellScriptEncoding).toString(Resources.powershellCommandEncoding);
    const result = await this.runner.captureAsync(Resources.windowsPowershellCommand, [...Resources.powershellOptions, command], this.folder, Resources.fileHoldersTimeout,
      { ...this.environment, [Resources.fileHoldersFilesVariable]: files.join(Resources.lineSeparator) });
    if (!result.isSuccessful)
      return Resources.formatFileHoldersReadFailed(result.exitCode, result.text);
    return Resources.formatFileHolders(result.output.trim());
  }
}
