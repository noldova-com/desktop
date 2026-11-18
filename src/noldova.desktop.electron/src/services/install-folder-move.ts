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
import { Resources } from "../resources.js";

export class InstallFolderMove {
  private readonly app: Pick<IApplicationHost, "whenReady" | "releaseSingleInstanceLock" | "relaunch" | "exit">;
  private readonly shell: Pick<IShellHost, "trashItem">;
  private readonly process: Pick<IMainProcessEnvironment, "platform" | "execPath" | "argv" | "env" | "programs" | "files">;
  private readonly log: IMainProcessLog;

  public constructor(app: Pick<IApplicationHost, "whenReady" | "releaseSingleInstanceLock" | "relaunch" | "exit">, shell: Pick<IShellHost, "trashItem">,
    process: Pick<IMainProcessEnvironment, "platform" | "execPath" | "argv" | "env" | "programs" | "files">, log: IMainProcessLog) {
    this.app = app;
    this.shell = shell;
    this.process = process;
    this.log = log;
  }

  public async runAsync(isPackaged: boolean, productName: string, installFolder: string | null): Promise<boolean> {
    const process = this.process;
    const bundleName = `${productName}${Resources.appBundleExtension}`;
    const bundle = posix.resolve(process.execPath, ...Resources.bundleFromProgramSegments);
    if (!isPackaged || process.platform !== Resources.macPlatform || Object.isNull(installFolder) || bundle !== posix.join(Resources.macApplicationsFolder, bundleName))
      return false;
    const target = posix.join(Resources.macApplicationsFolder, installFolder, bundleName);
    if (await this.existsAsync(target)) {
      this.log.write(Resources.formatInstallFolderTargetExists(bundle, target));
      return false;
    }
    if (!await this.copyAsync(bundle, target))
      return false;
    await this.app.whenReady();
    try {
      await this.shell.trashItem(bundle);
      this.log.write(Resources.formatInstallFolderMoved(bundle, target));
    }
    catch (error) {
      this.log.write(Resources.formatInstallFolderOldCopyKept(bundle, target, String(error)));
    }
    this.app.releaseSingleInstanceLock();
    this.app.relaunch({ execPath: posix.join(target, posix.relative(bundle, process.execPath)), args: process.argv.slice(1) });
    this.log.flush();
    this.app.exit(Resources.quitExitCode);
    return true;
  }

  private async copyAsync(bundle: string, target: string): Promise<boolean> {
    const staging = posix.join(posix.dirname(target), `${Resources.installFolderStagingPrefix}${posix.basename(target)}`);
    try {
      await this.runProgramAsync(Resources.removeProgram, [Resources.removeRecursiveOption, staging]);
      await this.runProgramAsync(Resources.dittoProgram, [bundle, staging]);
      await this.runProgramAsync(Resources.moveProgram, [staging, target]);
      return true;
    }
    catch (error) {
      this.log.write(Resources.formatInstallFolderNotWritable(bundle, target, String(error)));
      await this.runProgramAsync(Resources.removeProgram, [Resources.removeRecursiveOption, staging])
        .catch((failure: unknown) => this.log.write(Resources.formatInstallFolderStagingLeft(staging, String(failure))));
      return false;
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
