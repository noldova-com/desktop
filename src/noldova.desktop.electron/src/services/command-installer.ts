/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageBoxOptions } from "electron";

import "@noldova/context.core";

import { PathCommandOutcome } from "../enums/path-command-outcome.js";
import { PathCommandException } from "../exceptions/path-command.exception.js";
import type { IDialogHost } from "../interfaces/i-dialog-host.js";
import { Resources } from "../resources.js";
import type { OpenWindow } from "./open-window.js";
import type { PathCommand } from "./path-command.js";

export class CommandInstaller {
  private readonly dialog: IDialogHost;
  private readonly platform: string;
  private readonly executablePath: string;
  private readonly createPathCommand: (executablePath: string) => PathCommand;
  private readonly log: (text: string) => void;

  public constructor(dialog: IDialogHost, platform: string, executablePath: string, createPathCommand: (executablePath: string) => PathCommand, log: (text: string) => void) {
    this.dialog = dialog;
    this.platform = platform;
    this.executablePath = executablePath;
    this.createPathCommand = createPathCommand;
    this.log = log;
  }

  public async installAsync(open: OpenWindow | null): Promise<boolean> {
    if (Object.isNull(open) || this.platform !== Resources.macPlatform)
      return false;
    const command = this.createPathCommand(this.executablePath);
    let outcome: PathCommandOutcome;
    try {
      outcome = await command.installAsync();
    }
    catch (error) {
      if (!(error instanceof PathCommandException))
        throw error;
      this.log(error.message);
      await this.dialog.showMessageBox(open.window.id, { type: Resources.warningBoxType, message: Resources.commandNotInstalled, detail: error.message, noLink: true });
      return false;
    }
    if (outcome === PathCommandOutcome.Cancelled)
      return false;
    await this.dialog.showMessageBox(open.window.id, CommandInstaller.describe(outcome, command.linkPath));
    return outcome === PathCommandOutcome.Installed || outcome === PathCommandOutcome.AlreadyInstalled;
  }

  private static describe(outcome: PathCommandOutcome, link: string): MessageBoxOptions {
    switch (outcome) {
      case PathCommandOutcome.Installed:
        return { type: Resources.infoBoxType, message: Resources.commandInstalled, detail: Resources.formatCommandInstalledDetail(link), noLink: true };
      case PathCommandOutcome.AlreadyInstalled:
        return { type: Resources.infoBoxType, message: Resources.commandAlreadyInstalled, detail: Resources.formatCommandAlreadyInstalledDetail(link), noLink: true };
      case PathCommandOutcome.Occupied:
        return { type: Resources.warningBoxType, message: Resources.commandNotInstalled, detail: Resources.formatCommandOccupiedDetail(link), noLink: true };
      default:
        return { type: Resources.warningBoxType, message: Resources.commandNotInstalled, detail: Resources.commandMissingDetail, noLink: true };
    }
  }
}
