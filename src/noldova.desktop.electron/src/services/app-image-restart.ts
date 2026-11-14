/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { AppImageSource, type IProcessStarter, ProcessLaunchCommand } from "@noldova/desktop.runtime";

import { Resources } from "../resources.js";
import { AppImageEnvironment } from "./app-image-environment.js";
import { DebianPackage } from "./debian-package.js";

export class AppImageRestart {
  private readonly starter: IProcessStarter;
  private readonly image: string;
  private readonly launchArguments: readonly string[];
  private readonly environment: NodeJS.ProcessEnv;
  private readonly processId: number;
  private readonly errorFile: string;
  private readonly waitLimit: number;
  private readonly processFolder: string;
  private started: number | undefined;

  private constructor(starter: IProcessStarter, image: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, processId: number, errorFile: string,
    waitLimit: number, processFolder: string) {
    this.starter = starter;
    this.image = image;
    this.launchArguments = [...launchArguments];
    this.environment = AppImageEnvironment.restore(environment);
    this.processId = processId;
    this.errorFile = errorFile;
    this.waitLimit = waitLimit;
    this.processFolder = processFolder;
    this.started = undefined;
  }

  public static find(platform: string, environment: NodeJS.ProcessEnv, executablePath: string, launchArguments: readonly string[], starter: IProcessStarter, processId: number,
    errorFile: string, waitLimit: number = Resources.restartWaitLimit, processFolder: string = Resources.processStatusFolder): AppImageRestart | null {
    const source = platform === Resources.linuxPlatform ? AppImageSource.find(environment, executablePath) : null;
    const program = source?.file ?? (DebianPackage.isInstalled(platform, executablePath) ? executablePath : null);
    return Object.isNull(program) ? null : new AppImageRestart(starter, program, launchArguments, environment, processId, errorFile, waitLimit, processFolder);
  }

  public async startAsync(): Promise<void> {
    const startTime = await AppImageRestart.readStartTimeAsync(this.processFolder, this.processId);
    const command = await ProcessLaunchCommand.createAsync(Resources.linuxPlatform, Resources.restartShell,
      [...Resources.restartShellArguments, Resources.restartName, String(this.processId), startTime, String(this.waitLimit), this.image, ...this.launchArguments]);
    this.started = await this.starter.startAsync(command.executable, command.arguments, this.environment, this.errorFile);
  }

  public cancel(): void {
    const started = this.started;
    this.started = undefined;
    if (!Object.isUndefined(started))
      AppImageRestart.end(started);
  }

  private static async readStartTimeAsync(processFolder: string, processId: number): Promise<string> {
    try {
      const status = await readFile(path.join(processFolder, String(processId), Resources.processStatusFile), Resources.textEncoding);
      return status.slice(status.lastIndexOf(Resources.processStatusNameEnd) + Resources.processStatusNameEnd.length).split(Resources.processStatusSeparator)
        .slice(Resources.processStartTimeField, Resources.processStartTimeField + 1).join(String.empty);
    }
    catch {
      return String.empty;
    }
  }

  private static end(processId: number): void {
    try {
      process.kill(processId);
    }
    catch {
      return;
    }
  }
}
