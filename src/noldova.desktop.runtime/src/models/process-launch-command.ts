/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants } from "node:fs";
import { access, readdir } from "node:fs/promises";

import "@noldova/context.core";
import { ArgumentException, ExceptionOptions } from "@noldova/context.exceptions";

import { LaunchDescriptorsUnavailableException } from "../exceptions/launch-descriptors-unavailable.exception.js";
import { LaunchShellUnavailableException } from "../exceptions/launch-shell-unavailable.exception.js";
import { Resources } from "../resources.js";
import { ProductInfo } from "./product-info.js";

export class ProcessLaunchCommand {
  public readonly executable: string;
  public readonly arguments: readonly string[];

  private constructor(executable: string, launchArguments: readonly string[]) {
    this.executable = executable;
    this.arguments = launchArguments;
  }

  public static async createAsync(platform: string, executablePath: string, launchArguments: readonly string[]): Promise<ProcessLaunchCommand> {
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);
    if (platform !== Resources.linuxPlatform)
      return new ProcessLaunchCommand(executablePath, [...launchArguments]);
    await ProcessLaunchCommand.requireLinuxPrerequisitesAsync();
    return new ProcessLaunchCommand(Resources.launchShell, [...Resources.launchShellArguments, `${ProductInfo.current.slug}${Resources.launchNameSuffix}`, executablePath, ...launchArguments]);
  }

  private static async requireLinuxPrerequisitesAsync(): Promise<void> {
    try {
      await access(Resources.launchShell, constants.X_OK);
    }
    catch (error) {
      throw new LaunchShellUnavailableException(new ExceptionOptions(error));
    }
    try {
      await access(Resources.launchDescriptors, constants.R_OK | constants.X_OK);
      await readdir(Resources.launchDescriptors);
    }
    catch (error) {
      throw new LaunchDescriptorsUnavailableException(new ExceptionOptions(error));
    }
  }
}
