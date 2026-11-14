/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MessageBoxOptions, RenderProcessGoneDetails } from "electron";

import "@noldova/context.core";

import type { IMainProcessLog } from "../interfaces/i-main-process-log.js";
import type { IMainProcessEnvironment } from "../interfaces/i-main-process-environment.js";
import type { IDialogHost } from "../interfaces/i-dialog-host.js";
import { Resources } from "../resources.js";
import type { OpenWindow } from "./open-window.js";

export class WindowRecovery {
  private readonly open: OpenWindow;
  private readonly dialog: IDialogHost;
  private readonly log: IMainProcessLog;
  private readonly process: IMainProcessEnvironment;
  private readonly quit: () => void;
  private readonly openLogFolderAsync: () => Promise<boolean>;
  private readonly reloadCrashLimit: number;
  private readonly rendererEndLimit: number;
  private readonly now: () => number;
  private reloadedAt: number | undefined;
  private isCrashingToReload: boolean = false;
  private isUnresponsive: boolean = false;
  private unresponsiveBox: AbortController | undefined;
  private endTimer: NodeJS.Timeout | undefined;

  public constructor(
    open: OpenWindow,
    dialog: IDialogHost,
    log: IMainProcessLog,
    process: IMainProcessEnvironment,
    quit: () => void,
    openLogFolderAsync: () => Promise<boolean>,
    reloadCrashLimit: number,
    rendererEndLimit: number,
    now: () => number = Date.now) {
    this.open = open;
    this.dialog = dialog;
    this.log = log;
    this.process = process;
    this.quit = quit;
    this.openLogFolderAsync = openLogFolderAsync;
    this.reloadCrashLimit = reloadCrashLimit;
    this.rendererEndLimit = rendererEndLimit;
    this.now = now;
    this.reloadedAt = undefined;
    this.unresponsiveBox = undefined;
    this.endTimer = undefined;
    open.window.webContents.on(Resources.renderProcessGoneEvent, (_event, details) => void this.recoverFromGoneAsync(details));
    open.window.on(Resources.unresponsiveEvent, () => void this.recoverFromUnresponsiveAsync());
    open.window.on(Resources.responsiveEvent, () => this.noteResponsive());
  }

  private async recoverFromGoneAsync(details: RenderProcessGoneDetails): Promise<void> {
    if (this.open.window.isDestroyed() || (details.reason === Resources.cleanExitReason && !this.isCrashingToReload))
      return;
    this.log.write(Resources.formatRendererGone(details.reason, details.exitCode));
    this.isUnresponsive = false;
    this.unresponsiveBox?.abort();
    if (this.isCrashingToReload) {
      this.isCrashingToReload = false;
      this.stopEndTimer();
      this.reload();
      return;
    }
    this.open.showNow();
    if (!Object.isUndefined(this.reloadedAt) && this.now() - this.reloadedAt < this.reloadCrashLimit) {
      this.log.write(Resources.windowStoppedAgainRecord);
      const again = await this.askAsync(Resources.windowStopped, Resources.windowStoppedAgainDetail, [Resources.openLogFolderButton, Resources.quitButton], 1);
      if (again === Resources.openLogFolderButton)
        await this.openLogFolderAsync();
      else
        this.quit();
      return;
    }
    const choice = await this.askAsync(Resources.windowStopped, Resources.windowStoppedDetail, [Resources.reloadButton, Resources.quitButton], 1);
    if (choice === Resources.reloadButton)
      this.reload();
    else
      this.quit();
  }

  private async recoverFromUnresponsiveAsync(): Promise<void> {
    if (this.isUnresponsive)
      return;
    this.isUnresponsive = true;
    this.log.write(Resources.windowUnresponsive);
    const box = new AbortController();
    this.unresponsiveBox = box;
    const choice = await this.askAsync(Resources.windowNotResponding, Resources.windowNotRespondingDetail, [Resources.waitButton, Resources.reloadButton], 0, box.signal);
    this.unresponsiveBox = undefined;
    if (box.signal.aborted || choice !== Resources.reloadButton)
      return;
    this.isUnresponsive = false;
    this.isCrashingToReload = true;
    this.open.window.webContents.forcefullyCrashRenderer();
    this.endTimer = setTimeout(() => this.endRenderer(), this.rendererEndLimit);
  }

  private endRenderer(): void {
    this.endTimer = undefined;
    if (this.open.window.isDestroyed())
      return;
    const processId = this.open.window.webContents.getOSProcessId();
    if (processId <= 0 || processId === this.process.processId) {
      this.log.write(Resources.formatNoRendererToEnd(processId));
      this.reloadWithoutStop();
      return;
    }
    try {
      this.process.endProcess(processId);
      this.log.write(Resources.formatRendererEnded(processId));
    }
    catch (failure) {
      this.log.write(Resources.formatRendererNotEnded(String(failure)));
      this.reloadWithoutStop();
    }
  }

  private reloadWithoutStop(): void {
    this.isCrashingToReload = false;
    this.reload();
  }

  private stopEndTimer(): void {
    if (!Object.isUndefined(this.endTimer))
      clearTimeout(this.endTimer);
    this.endTimer = undefined;
  }

  private noteResponsive(): void {
    if (!this.isUnresponsive)
      return;
    this.isUnresponsive = false;
    this.log.write(Resources.windowResponsiveAgain);
    this.unresponsiveBox?.abort();
  }

  private reload(): void {
    this.reloadedAt = this.now();
    this.open.window.webContents.reload();
  }

  private async askAsync(message: string, detail: string, buttons: readonly string[], cancelId: number, signal?: AbortSignal): Promise<string | null> {
    const options: MessageBoxOptions = { type: Resources.warningBoxType, message, detail, buttons: [...buttons], defaultId: 0, cancelId, noLink: true };
    if (!Object.isUndefined(signal))
      options.signal = signal;
    const { response } = await this.dialog.showMessageBox(this.open.window.id, options);
    if (signal?.aborted === true)
      return null;
    const choice = buttons[response] ?? null;
    if (!Object.isNull(choice))
      this.log.write(Resources.formatRecoveryChoice(choice));
    return choice;
  }
}
