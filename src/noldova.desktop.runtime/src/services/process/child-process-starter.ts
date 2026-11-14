/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { open } from "node:fs/promises";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { LaunchStartFailedException } from "../../exceptions/launch-start-failed.exception.js";
import type { IPosixProcessApi } from "../../interfaces/i-posix-process-api.js";
import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import { Resources } from "../../resources.js";
import { PosixProcessApi } from "./posix-process-api.js";

export class ChildProcessStarter implements IProcessStarter {
  private readonly isWindows: boolean;
  private readonly posix: IPosixProcessApi;
  private readonly isHidden: boolean;
  private readonly disclaimFunction: string | undefined;

  public constructor(platform: string = process.platform, posix: IPosixProcessApi = PosixProcessApi.create(), isHidden: boolean = true,
    disclaimFunction: string | null = platform === Resources.macPlatform ? Resources.disclaimSystemFunction : null) {
    this.isWindows = platform === Resources.windowsPlatform;
    this.posix = posix;
    this.isHidden = isHidden;
    this.disclaimFunction = disclaimFunction ?? undefined;
  }

  public static create(platform: string, isHidden: boolean = true): ChildProcessStarter {
    return new ChildProcessStarter(platform, PosixProcessApi.create(), isHidden);
  }

  private static async spawnAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errors: number,
    workingFolder: string | undefined, isHidden: boolean): Promise<number> {
    const child = spawn(executable, launchArguments, {
      cwd: workingFolder,
      detached: true,
      stdio: [Resources.ignoredOutput, Resources.ignoredOutput, errors],
      windowsHide: isHidden,
      env: environment
    });
    try {
      await once(child, Resources.spawnEvent);
    }
    catch (error) {
      throw new LaunchStartFailedException(executable, new ExceptionOptions(error));
    }
    child.unref();
    return Number(child.pid);
  }

  public async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string, workingFolder?: string): Promise<number> {
    const errors = await open(errorFile, Resources.appendFlag, Resources.privateFileMode);
    try {
      return this.isWindows
        ? await ChildProcessStarter.spawnAsync(executable, launchArguments, environment, errors.fd, workingFolder, this.isHidden)
        : this.startDetached(executable, launchArguments, environment, errors.fd, workingFolder);
    }
    finally {
      await errors.close();
    }
  }

  private startDetached(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errors: number, workingFolder: string | undefined): number {
    const entries = Object.entries(environment).flatMap(([name, value]) => Object.isUndefined(value) ? [] : [`${name}${Resources.environmentEntrySeparator}${value}`]);
    try {
      return this.posix.startDetached(executable, launchArguments, entries, errors, workingFolder, undefined, undefined, this.disclaimFunction);
    }
    catch (error) {
      throw new LaunchStartFailedException(executable, new ExceptionOptions(error));
    }
  }
}
