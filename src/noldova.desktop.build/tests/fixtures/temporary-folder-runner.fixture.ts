/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProcessResult } from "../../src/models/processes/process-result.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";

export class TemporaryFolderRunnerFixture extends ProcessRunner {
  private static readonly TEMPORARY_VARIABLES: readonly string[] = ["TMPDIR", "TEMP", "TMP"];
  private static readonly CONFIGURATION_FILES: readonly (readonly [string, string])[] = [["npm_config_userconfig", "user.npmrc"], ["npm_config_globalconfig", "global.npmrc"]];

  private readonly folder: string;

  private constructor(folder: string) {
    super();
    this.folder = folder;
  }

  public static async createAsync(folder: string): Promise<TemporaryFolderRunnerFixture> {
    await mkdir(folder, { recursive: true });
    for (const [, file] of TemporaryFolderRunnerFixture.CONFIGURATION_FILES)
      await writeFile(path.join(folder, file), String.empty);
    return new TemporaryFolderRunnerFixture(folder);
  }

  public override captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    const variables = Object.fromEntries([
      ...TemporaryFolderRunnerFixture.TEMPORARY_VARIABLES.map(t => [t, this.folder]),
      ...TemporaryFolderRunnerFixture.CONFIGURATION_FILES.map(([variable, file]) => [variable, path.join(this.folder, file)])
    ]);
    return super.captureAsync(command, commandArguments, directory, timeout, { ...environment ?? process.env, ...variables });
  }
}
