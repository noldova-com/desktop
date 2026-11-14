/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";

import type { AppDetailsOptions } from "electron";

import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class TaskbarIdentity {
  public readonly appId: string;
  public readonly iconPath: string;
  public readonly relaunchCommand: string;

  public constructor(appId: string, iconPath: string, relaunchCommand: string) {
    ArgumentException.throwIfNullOrWhitespace(appId, Resources.appIdParameter);
    ArgumentException.throwIfNullOrWhitespace(iconPath, Resources.iconPathParameter);
    ArgumentException.throwIfNullOrWhitespace(relaunchCommand, Resources.relaunchCommandParameter);

    this.appId = appId;
    this.iconPath = iconPath;
    this.relaunchCommand = relaunchCommand;
  }

  public static async createAsync(isPackaged: boolean, executablePath: string, iconFile: string, mainScript: string, argv: readonly string[], workingDirectory: string): Promise<TaskbarIdentity> {
    const kept = argv.flatMap(t => Resources.relaunchArgumentPrefixes
      .filter(prefix => t.startsWith(prefix))
      .map(prefix => `${prefix}${path.resolve(workingDirectory, t.slice(prefix.length))}`));
    const checkout = path.resolve(path.dirname(path.resolve(workingDirectory, mainScript)), ...Resources.repositoryRootSegments);
    const parts = isPackaged ? [executablePath, ...kept] : [executablePath, path.join(checkout, ...Resources.developmentPackageSegments), ...kept];
    return new TaskbarIdentity(
      isPackaged ? Resources.appUserModelId : await TaskbarIdentity.identifyCheckoutAsync(checkout),
      isPackaged ? executablePath : iconFile,
      parts.map(t => Resources.formatQuotedArgument(t)).join(Resources.argumentSeparator));
  }

  public toAppDetails(): AppDetailsOptions {
    return {
      appId: this.appId,
      appIconPath: this.iconPath,
      appIconIndex: 0,
      relaunchCommand: this.relaunchCommand,
      relaunchDisplayName: Resources.applicationName
    };
  }

  private static async identifyCheckoutAsync(checkout: string): Promise<string> {
    const folder = await realpath(checkout).catch(() => checkout);
    const hash = createHash(Resources.checkoutHashAlgorithm).update(folder).digest(Resources.hexEncoding).slice(0, Resources.checkoutHashLength);
    return `${Resources.developmentAppUserModelId}${Resources.idSeparator}${hash}`;
  }
}
