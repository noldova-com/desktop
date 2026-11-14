/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import type { DataDirectory } from "../services/data-directory/data-directory.js";
import { ClientSettings } from "./client-settings.js";
import { ProcessSettings } from "./process-settings.js";

export class LaunchSettings {
  public readonly dataDirectory: DataDirectory;
  public readonly executablePath: string;
  public readonly entryPath: string;
  public readonly environment: NodeJS.ProcessEnv;
  public readonly platform: string;
  public readonly idleGraceMilliseconds: number;
  public readonly launchTimeout: number;
  public readonly clientSettings: ClientSettings;
  public readonly launchLimit: number;
  public readonly stopTimeout: number;

  public constructor(
    dataDirectory: DataDirectory,
    executablePath: string,
    entryPath: string,
    environment: NodeJS.ProcessEnv,
    platform: string,
    idleGraceMilliseconds: number = Resources.idleGrace,
    launchTimeout: number = Resources.launchTimeout,
    clientSettings: ClientSettings = new ClientSettings(),
    launchLimit: number = Math.max(launchTimeout, Resources.launchLimit),
    stopTimeout: number = new ProcessSettings().stopLimit + Resources.stopTimeoutMargin) {
    ArgumentException.throwIfNullOrWhitespace(executablePath, Resources.executablePathParameterName);
    ArgumentException.throwIfNullOrWhitespace(entryPath, Resources.entryPathParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(idleGraceMilliseconds, Resources.idleGraceParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(launchTimeout, Resources.launchTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(launchLimit, Resources.launchLimitParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(stopTimeout, Resources.stopTimeoutParameterName);
    if (launchLimit < launchTimeout)
      throw new ArgumentOutOfRangeException(Resources.launchLimitParameterName, launchLimit, Resources.launchLimitTooShort);

    this.dataDirectory = dataDirectory;
    this.executablePath = executablePath;
    this.entryPath = entryPath;
    this.environment = environment;
    this.platform = platform;
    this.idleGraceMilliseconds = idleGraceMilliseconds;
    this.launchTimeout = launchTimeout;
    this.clientSettings = clientSettings;
    this.launchLimit = launchLimit;
    this.stopTimeout = stopTimeout;
  }
}
