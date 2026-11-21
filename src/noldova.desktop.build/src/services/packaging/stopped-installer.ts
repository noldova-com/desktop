/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import type { ProcessRunner } from "../processes/process-runner.ts";
import { Resources } from "../../resources.ts";

export class StoppedInstaller {
  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
  }

  public async describeAsync(installFolder: string, temporary: string | undefined, started: number, processId: number | undefined): Promise<string> {
    const parts = [await StoppedInstaller.describeInstallFolderAsync(installFolder), await StoppedInstaller.describeTemporaryAsync(temporary, started)];
    if (!Object.isUndefined(processId))
      parts.push(await this.describeProcessesAsync(processId));
    return parts.join(Resources.lineSeparator);
  }

  private static async describeInstallFolderAsync(installFolder: string): Promise<string> {
    if (!existsSync(installFolder))
      return Resources.formatInstallerCreatedNothing(installFolder);
    const lines: string[] = [];
    const files = await StoppedInstaller.readAsync(installFolder, lines, () => StoppedInstaller.listFilesAsync(installFolder)) ?? [];
    for (const file of files) {
      const item = await StoppedInstaller.readAsync(file, lines, () => stat(file));
      if (!Object.isNull(item))
        lines.push(Resources.formatInstalledFileSize(path.relative(installFolder, file), item.size));
    }
    return Resources.formatInstallerStoppedFiles(installFolder, files.length, lines);
  }

  private static async describeTemporaryAsync(temporary: string | undefined, started: number): Promise<string> {
    if (Object.isUndefined(temporary))
      return Resources.installerTemporaryUnknown;
    const lines: string[] = [];
    const folders: string[] = [];
    const entries = existsSync(temporary) ? await StoppedInstaller.readAsync(temporary, lines, () => readdir(temporary, { withFileTypes: true })) ?? [] : [];
    for (const entry of entries.filter(t => t.isDirectory() && Resources.installerTemporaryFolderPattern.test(t.name))) {
      const folder = path.join(temporary, entry.name);
      const item = await StoppedInstaller.readAsync(folder, lines, () => stat(folder));
      if (!Object.isNull(item) && item.mtimeMs >= started - Resources.installerTemporaryMargin)
        folders.push(folder);
    }
    if (folders.length === 0)
      lines.unshift(Resources.formatInstallerTemporaryNone(temporary));
    for (const folder of folders.sort()) {
      lines.push(Resources.formatInstallerTemporaryFolder(folder));
      for (const name of (await StoppedInstaller.readAsync(folder, lines, () => readdir(folder)) ?? []).sort())
        await StoppedInstaller.describeTemporaryEntryAsync(path.join(folder, name), name, lines);
    }
    return lines.join(Resources.lineSeparator);
  }

  private static async describeTemporaryEntryAsync(entry: string, name: string, lines: string[]): Promise<void> {
    const item = await StoppedInstaller.readAsync(entry, lines, () => stat(entry));
    if (Object.isNull(item))
      return;
    if (!item.isDirectory()) {
      lines.push(Resources.formatInstalledFileSize(name, item.size));
      return;
    }
    const files = await StoppedInstaller.readAsync(entry, lines, () => StoppedInstaller.listFilesAsync(entry)) ?? [];
    let bytes = 0;
    for (const file of files)
      bytes += (await StoppedInstaller.readAsync(file, lines, () => stat(file)))?.size ?? 0;
    lines.push(Resources.formatInstallerTemporaryContent(name, files.length, bytes));
  }

  private static async readAsync<T>(target: string, lines: string[], read: () => Promise<T>): Promise<T | null> {
    try {
      return await read();
    }
    catch (error) {
      lines.push(Resources.formatInstallerPathUnreadable(target, error));
      return null;
    }
  }

  private static async listFilesAsync(folder: string): Promise<string[]> {
    return (await readdir(folder, { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile())
      .map(t => path.join(t.parentPath, t.name))
      .sort();
  }

  private async describeProcessesAsync(processId: number): Promise<string> {
    const command = Buffer.from(Resources.installerProcessesScript, Resources.powershellScriptEncoding).toString(Resources.powershellCommandEncoding);
    try {
      const result = await this.runner.captureAsync(Resources.windowsPowershellCommand, [...Resources.powershellOptions, command], this.folder, Resources.installerProcessesTimeout,
        { ...this.environment, [Resources.installerProcessVariable]: String(processId) });
      if (!result.isSuccessful)
        return Resources.formatInstallerProcessesReadFailed(processId, `${Resources.windowsPowershellCommand} exited with ${String(result.exitCode)}:${Resources.lineSeparator}${result.text}`);
      const output = result.output.trim();
      return output.length === 0 ? Resources.formatInstallerProcessesNone(processId) : Resources.formatInstallerProcesses(processId, output);
    }
    catch (error) {
      return Resources.formatInstallerProcessesReadFailed(processId, error instanceof Error ? error.message : String(error));
    }
  }
}
