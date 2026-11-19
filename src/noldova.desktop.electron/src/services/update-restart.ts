/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/context.core";
import { ChildProcessStarter, type Installation, type ProcessPresence, RuntimeBuild } from "@noldova/desktop.runtime";

import type { IApplicationHost } from "../interfaces/i-application-host.js";
import type { IDialogHost } from "../interfaces/i-dialog-host.js";
import type { IMainProcessEnvironment } from "../interfaces/i-main-process-environment.js";
import type { INativeUpdater } from "../interfaces/i-native-updater.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { MainProcessPhase } from "../models/main-process-phase.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import type { WindowRegistry } from "../models/window-registry.js";
import { Resources } from "../resources.js";
import { AppImageRestart } from "./app-image-restart.js";
import type { RestartArguments } from "./restart-arguments.js";
import type { UpdateTargetConnector } from "./update-target-connector.js";
import { UpdateStop } from "./update-stop.js";
import { UpdateWorkQuestion } from "./update-work-question.js";

export class UpdateRestart {
  private readonly app: IApplicationHost;
  private readonly nativeUpdater: INativeUpdater;
  private readonly dialog: IDialogHost;
  private readonly process: IMainProcessEnvironment;
  private readonly logsFolder: string;
  private readonly launchArguments: readonly string[];
  private readonly handoverFolders: readonly string[];
  private readonly restartArguments: RestartArguments;
  private readonly installation: Installation;
  private readonly presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">;
  private readonly connector: UpdateTargetConnector;
  private readonly windows: WindowRegistry;
  private readonly phase: MainProcessPhase;
  private readonly findPromptAsync: () => Promise<IQuitPrompt | null>;
  private readonly exitNow: () => void;
  private readonly log: (text: string) => void;
  private restarting: Promise<void> | undefined;
  private isQuitHeld: boolean;
  private question: UpdateWorkQuestion | undefined;

  public constructor(
    app: IApplicationHost,
    nativeUpdater: INativeUpdater,
    dialog: IDialogHost,
    process: IMainProcessEnvironment,
    logsFolder: string,
    launchArguments: readonly string[],
    handoverFolders: readonly string[],
    restartArguments: RestartArguments,
    installation: Installation,
    presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">,
    connector: UpdateTargetConnector,
    windows: WindowRegistry,
    phase: MainProcessPhase,
    findPromptAsync: () => Promise<IQuitPrompt | null>,
    exitNow: () => void,
    log: (text: string) => void) {
    this.app = app;
    this.nativeUpdater = nativeUpdater;
    this.dialog = dialog;
    this.process = process;
    this.logsFolder = logsFolder;
    this.launchArguments = launchArguments;
    this.handoverFolders = handoverFolders;
    this.restartArguments = restartArguments;
    this.installation = installation;
    this.presence = presence;
    this.connector = connector;
    this.windows = windows;
    this.phase = phase;
    this.findPromptAsync = findPromptAsync;
    this.exitNow = exitNow;
    this.log = log;
    this.restarting = undefined;
    this.isQuitHeld = false;
    this.question = undefined;
  }

  public async restartAsync(record: UpdateReadyRecord, handoff: IUpdateHandoff): Promise<void> {
    const restart = AppImageRestart.find(this.process.platform, this.process.env, this.process.execPath, this.launchArguments, new ChildProcessStarter(), this.process.processId,
      join(this.logsFolder, Resources.restartErrorFile));
    const stop = new UpdateStop(this.installation, this.presence, (t, onChange) => this.connector.connectAsync(t, onChange),
      (work, read, waitForChange) => this.askWorkAsync(work, read, waitForChange), this.process.processId, RuntimeBuild.identity.productVersion, Date.now, delay, restart, this.log);
    const ended = Promise.withResolvers<void>();
    this.restarting = ended.promise;
    try {
      if ((await stop.runAsync(record.version, () => this.handOffAsync(record, handoff))).isHandedOff)
        await this.quitAfterHandoffAsync();
    }
    finally {
      this.restarting = undefined;
      ended.resolve();
      if (this.isQuitHeld && !this.phase.isExiting)
        this.app.quit();
      this.isQuitHeld = false;
    }
  }

  public holdQuit(): boolean {
    if (Object.isUndefined(this.restarting))
      return false;
    this.isQuitHeld = true;
    return true;
  }

  public async whenRestartedAsync(): Promise<void> {
    await this.restarting;
  }

  public answer(prompt: IQuitPrompt, choice: unknown): boolean {
    return this.question?.answer(prompt, choice) === true;
  }

  public dismiss(prompt: IQuitPrompt): void {
    this.question?.dismiss(prompt);
  }

  private async handOffAsync(record: UpdateReadyRecord, handoff: IUpdateHandoff): Promise<number | null> {
    if (this.process.platform === Resources.linuxPlatform || this.handoverFolders.length === 0)
      return handoff.handOffAsync(record);
    await this.restartArguments.writeAsync(record.version, this.handoverFolders, Date.now());
    try {
      return await handoff.handOffAsync(record);
    }
    catch (error) {
      await this.restartArguments.removeAsync().catch((failure: unknown) => this.log(Resources.formatRestartArgumentsNotRemoved(String(failure))));
      throw error;
    }
  }

  private async askWorkAsync(work: readonly string[], readWorkAsync: () => Promise<readonly string[]>, waitForChangeAsync: (signal: AbortSignal) => Promise<void>): Promise<readonly string[] | null> {
    const prompt = await this.findPromptAsync();
    if (Object.isNull(prompt))
      return null;
    const question = new UpdateWorkQuestion(prompt, readWorkAsync, waitForChangeAsync);
    this.question = question;
    try {
      return await question.askAsync(work);
    }
    finally {
      this.question = undefined;
    }
  }

  private async quitAfterHandoffAsync(): Promise<void> {
    this.phase.isExiting = true;
    if (this.process.platform === Resources.macPlatform) {
      const failure = await this.quitAndInstallAsync();
      if (Object.isNull(failure))
        return;
      this.log(Resources.formatUpdateRelaunchFailed(String(failure)));
      await this.dialog.showMessageBox(null, {
        type: Resources.warningBoxType, message: Resources.updateRelaunchFailed, detail: Resources.updateRelaunchFailedDetail, buttons: [Resources.okButton], defaultId: 0, cancelId: 0,
        noLink: true
      }).catch(() => undefined);
    }
    this.exitNow();
  }

  private async quitAndInstallAsync(): Promise<unknown> {
    for (const open of this.windows.all)
      open.closeNow();
    const failed = new Promise<unknown>(resolve => this.nativeUpdater.once(Resources.errorEvent, error => resolve(error)));
    const quitting = new Promise<unknown>(resolve => this.app.on(Resources.willQuitEvent, () => resolve(null)));
    try {
      this.nativeUpdater.quitAndInstall();
    }
    catch (error) {
      return error;
    }
    return Promise.race([failed, quitting, delay(Resources.updateRelaunchLimit, Resources.updateNotRelaunchedInTime, { ref: false })]);
  }
}
