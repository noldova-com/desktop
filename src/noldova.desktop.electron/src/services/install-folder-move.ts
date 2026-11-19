/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { posix } from "node:path";

import "@noldova/context.core";

import type { IApplicationHost } from "../interfaces/i-application-host.js";
import type { IMainProcessEnvironment } from "../interfaces/i-main-process-environment.js";
import type { IMainProcessLog } from "../interfaces/i-main-process-log.js";
import type { IShellHost } from "../interfaces/i-shell-host.js";
import { ErrorCode } from "../models/error-code.js";
import { UpdateVersion } from "../models/update-version.js";
import { Resources } from "../resources.js";

export class InstallFolderMove {
  private readonly app: Pick<IApplicationHost, "whenReady" | "releaseSingleInstanceLock" | "relaunch" | "exit">;
  private readonly shell: Pick<IShellHost, "trashItem">;
  private readonly process: Pick<IMainProcessEnvironment, "platform" | "execPath" | "argv" | "env" | "processId" | "programs" | "files" | "probeProcess">;
  private readonly log: IMainProcessLog;

  public constructor(app: Pick<IApplicationHost, "whenReady" | "releaseSingleInstanceLock" | "relaunch" | "exit">, shell: Pick<IShellHost, "trashItem">,
    process: Pick<IMainProcessEnvironment, "platform" | "execPath" | "argv" | "env" | "processId" | "programs" | "files" | "probeProcess">, log: IMainProcessLog) {
    this.app = app;
    this.shell = shell;
    this.process = process;
    this.log = log;
  }

  public async runAsync(isPackaged: boolean, productName: string, installFolder: string | null): Promise<boolean> {
    const process = this.process;
    const bundleName = `${productName}${Resources.appBundleExtension}`;
    const bundle = posix.resolve(process.execPath, ...Resources.bundleFromProgramSegments);
    if (!isPackaged || process.platform !== Resources.macPlatform || Object.isNull(installFolder))
      return false;
    const target = posix.join(Resources.macApplicationsFolder, installFolder, bundleName);
    if (bundle === target) {
      await this.trashHomeCopyAsync(posix.join(process.env[Resources.homeVariable] ?? String.empty, Resources.macHomeApplicationsFolder, installFolder, bundleName), target);
      return false;
    }
    if (bundle !== posix.join(Resources.macApplicationsFolder, bundleName))
      return false;
    if (await this.existsAsync(target)) {
      if (!await this.isReplacedAsync(bundle, target))
        return false;
      await this.trashAsync(bundle, Resources.formatInstallFolderAlreadyThere(bundle, target), t => Resources.formatInstallFolderOldCopyKept(bundle, target, t));
    }
    else if (await this.copyAsync(bundle, target))
      await this.trashAsync(bundle, Resources.formatInstallFolderMoved(bundle, target), t => Resources.formatInstallFolderOldCopyKept(bundle, target, t));
    else
      return false;
    this.app.releaseSingleInstanceLock();
    this.app.relaunch({ execPath: posix.join(target, posix.relative(bundle, process.execPath)), args: process.argv.slice(1) });
    this.log.flush();
    this.app.exit(Resources.quitExitCode);
    return true;
  }

  private async trashHomeCopyAsync(copy: string, target: string): Promise<void> {
    if (!posix.isAbsolute(copy) || !await this.existsAsync(copy) || !await this.isReplacedAsync(copy, target))
      return;
    await this.trashAsync(copy, Resources.formatInstallFolderHomeCopyTrashed(copy, target), t => Resources.formatInstallFolderHomeCopyKept(copy, target, t));
  }

  private async trashAsync(bundle: string, moved: string, kept: (reason: string) => string): Promise<void> {
    await this.app.whenReady();
    try {
      await this.shell.trashItem(bundle);
      this.log.write(moved);
    }
    catch (error) {
      this.log.write(kept(String(error)));
    }
  }

  private async isReplacedAsync(bundle: string, target: string): Promise<boolean> {
    try {
      const identifier = await this.readBundleAsync(bundle, Resources.bundleIdentifierKey);
      const targetIdentifier = await this.readBundleAsync(target, Resources.bundleIdentifierKey);
      const version = await this.readBundleAsync(bundle, Resources.bundleVersionKey);
      const targetVersion = await this.readBundleAsync(target, Resources.bundleVersionKey);
      const isReplaced = identifier === targetIdentifier && UpdateVersion.isOffered(targetVersion) && !UpdateVersion.isNewer(version, targetVersion);
      if (!isReplaced)
        this.log.write(Resources.formatInstallFolderTargetExists(bundle, target, [identifier, targetIdentifier], [version, targetVersion]));
      return isReplaced;
    }
    catch (error) {
      this.log.write(Resources.formatInstallFolderTargetUnread(bundle, target, String(error)));
      return false;
    }
  }

  private async readBundleAsync(bundle: string, key: string): Promise<string> {
    const information = posix.join(bundle, ...Resources.bundleInformationSegments);
    return (await this.process.programs.runAsync(Resources.plistProgram, [...Resources.plistExtractArguments(key), information], this.process.env)).trim();
  }

  private async copyAsync(bundle: string, target: string): Promise<boolean> {
    const folder = posix.dirname(target);
    const name = posix.basename(target);
    const staging = posix.join(folder, `${Resources.installFolderStagingPrefix}${this.process.processId}${Resources.installFolderStagingSeparator}${name}`);
    try {
      await this.removeStaleStagingAsync(folder, name);
      await this.runProgramAsync(Resources.removeProgram, [Resources.removeRecursiveOption, staging]);
      await this.runProgramAsync(Resources.dittoProgram, [bundle, staging]);
      await this.process.files.rename(staging, target);
      return true;
    }
    catch (error) {
      this.log.write(Resources.formatInstallFolderNotWritable(bundle, target, String(error)));
      await this.runProgramAsync(Resources.removeProgram, [Resources.removeRecursiveOption, staging])
        .catch((failure: unknown) => this.log.write(Resources.formatInstallFolderStagingLeft(staging, String(failure))));
      return false;
    }
  }

  private async removeStaleStagingAsync(folder: string, name: string): Promise<void> {
    const suffix = `${Resources.installFolderStagingSeparator}${name}`;
    const entries = await this.process.files.readdir(folder).catch((error: unknown) => {
      if (!ErrorCode.isOneOf(error, [Resources.missingErrorCode]))
        throw error;
      return [];
    });
    for (const entry of entries) {
      const processId = entry.startsWith(Resources.installFolderStagingPrefix) && entry.endsWith(suffix)
        ? entry.slice(Resources.installFolderStagingPrefix.length, -suffix.length)
        : String.empty;
      if (Resources.installFolderStagingProcessPattern.test(processId) && !this.isRunning(Number(processId))) {
        const stale = posix.join(folder, entry);
        await this.runProgramAsync(Resources.removeProgram, [Resources.removeRecursiveOption, stale])
          .catch((failure: unknown) => this.log.write(Resources.formatInstallFolderStagingLeft(stale, String(failure))));
      }
    }
  }

  private isRunning(processId: number): boolean {
    try {
      this.process.probeProcess(processId);
      return true;
    }
    catch (error) {
      return !ErrorCode.isOneOf(error, [Resources.missingProcessErrorCode]);
    }
  }

  private async existsAsync(file: string): Promise<boolean> {
    try {
      await this.process.files.lstat(file);
      return true;
    }
    catch {
      return false;
    }
  }

  private async runProgramAsync(program: string, programArguments: readonly string[]): Promise<void> {
    await this.process.programs.runAsync(program, programArguments, this.process.env);
  }
}
