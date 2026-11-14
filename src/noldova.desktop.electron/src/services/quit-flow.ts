/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { QuitAnswer, StopPolicy } from "@noldova/desktop.protocol";

import { QuitOutcome } from "../enums/quit-outcome.js";
import type { ICloseGuard } from "../interfaces/i-close-guard.js";
import type { IQuitHost } from "../interfaces/i-quit-host.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import type { QuitCoordinator } from "./quit-coordinator.js";

export class QuitFlow implements ICloseGuard {
  private readonly host: IQuitHost;
  private readonly asker: QuitCoordinator;
  private quitting: Promise<QuitAnswer | null> | undefined;

  public constructor(host: IQuitHost, asker: QuitCoordinator) {
    this.host = host;
    this.asker = asker;
    this.quitting = undefined;
  }

  public get isQuitting(): boolean {
    return !Object.isUndefined(this.quitting);
  }

  public async canCloseAsync(prompt: IQuitPrompt): Promise<boolean> {
    if (!Object.isUndefined(this.quitting)) {
      this.asker.dismiss(prompt);
      await this.quitting;
    }
    if (this.host.isExiting())
      return false;
    if (!this.host.isLast(prompt))
      return true;
    if (this.host.keepsRunningWithoutWindows())
      return true;
    this.host.quit();
    return false;
  }

  public quitAsync(): Promise<QuitAnswer | null> {
    this.quitting ??= this.runAsync().finally(() => {
      this.quitting = undefined;
    });
    return this.quitting;
  }

  private async runAsync(): Promise<QuitAnswer | null> {
    if (!await this.host.saveAllAsync())
      return QuitAnswer.SaveFailed;
    if (await this.host.stopAsync(StopPolicy.IfIdle)) {
      const prompt = await this.host.findPromptAsync();
      const outcome = Object.isNull(prompt) ? QuitOutcome.Quit : await this.asker.askAsync(prompt);
      if (outcome === QuitOutcome.Stay)
        return QuitAnswer.Stayed;
      if (!await this.host.saveAllAsync())
        return QuitAnswer.SaveFailed;
      await this.host.stopAsync(outcome === QuitOutcome.StopWork ? StopPolicy.StopWork : StopPolicy.IfIdle);
    }
    this.host.exit();
    return null;
  }
}
