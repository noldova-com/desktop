/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { ProcessRunner } from "../processes/process-runner.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class UserPath {
  private readonly runner: ProcessRunner;
  private readonly folder: string;

  public constructor(runner: ProcessRunner, folder: string) {
    this.runner = runner;
    this.folder = folder;
  }

  public static count(value: string | null, entry: string): number {
    return (value ?? String.empty).split(Resources.userPathSeparator).filter(t => UserPath.isEntry(t, entry)).length;
  }

  public async readAsync(): Promise<string | null> {
    return (await this.readValueAsync())?.value ?? null;
  }

  public async removeAsync(entry: string): Promise<boolean> {
    const current = await this.readValueAsync();
    if (Object.isNull(current) || UserPath.count(current.value, entry) === 0)
      return false;
    const kept = current.value.split(Resources.userPathSeparator).filter(t => !UserPath.isEntry(t, entry)).join(Resources.userPathSeparator);
    await this.runner.requireAsync(Resources.registryCommand, kept.length === 0 ? Resources.userPathDeleteArguments
      : [...Resources.userPathAddArguments, Resources.registryTypeOption, current.type, Resources.registryDataOption, kept, Resources.registryForceOption],
      this.folder, Resources.registryTimeout);
    return true;
  }

  private static isEntry(item: string, entry: string): boolean {
    return item.toLowerCase() === entry.toLowerCase();
  }

  private async readValueAsync(): Promise<{ readonly type: string; readonly value: string } | null> {
    const result = await this.runner.captureAsync(Resources.registryCommand, Resources.userPathQueryArguments, this.folder, Resources.registryTimeout);
    if (result.exitCode === Resources.registryMissingExitCode)
      return null;
    const [, type, value] = Resources.userPathValuePattern.exec(result.output) ?? [];
    if (!result.isSuccessful || Object.isUndefined(type) || Object.isUndefined(value))
      throw new BuildException(Resources.formatUserPathUnreadable(result.exitCode, result.text));
    return { type, value };
  }
}
