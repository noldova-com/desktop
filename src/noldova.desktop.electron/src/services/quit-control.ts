/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { FailureCode, QuitAnswered, ShellMethods, StopPolicy, StopRequest, WorkReport } from "@noldova/desktop.protocol";

import type { IQuitControlParts } from "../interfaces/i-quit-control-parts.js";
import { Resources } from "../resources.js";
import { QuitCoordinator } from "./quit-coordinator.js";
import { QuitFlow } from "./quit-flow.js";

export class QuitControl {
  public readonly coordinator: QuitCoordinator;
  public readonly flow: QuitFlow;
  private readonly parts: IQuitControlParts;
  private readonly log: (text: string) => void;
  private runtimeQuit: Promise<void> | undefined;

  public constructor(parts: IQuitControlParts, log: (text: string) => void) {
    this.parts = parts;
    this.log = log;
    this.runtimeQuit = undefined;
    this.coordinator = new QuitCoordinator(() => this.readWorkAsync());
    this.flow = new QuitFlow({
      isExiting: () => parts.phase.isExiting,
      keepsRunningWithoutWindows: () => parts.keepsRunningWithoutWindows(),
      isLast: t => parts.windows.isLast(t),
      saveAllAsync: () => this.saveAllAsync(),
      stopAsync: t => this.stopAsync(t),
      findPromptAsync: () => parts.findPromptAsync(),
      quit: () => parts.quit(),
      exit: () => parts.exit()
    }, this.coordinator);
  }

  public get isQuitting(): boolean {
    return this.parts.phase.isExiting || this.flow.isQuitting;
  }

  public quitForRuntime(): void {
    this.runtimeQuit ??= this.quitForRuntimeAsync().finally(() => {
      this.runtimeQuit = undefined;
    });
  }

  private async quitForRuntimeAsync(): Promise<void> {
    await this.parts.whenRestartedAsync();
    if (this.parts.phase.isExiting)
      return;
    const answer = await this.flow.quitAsync();
    if (!Object.isNull(answer))
      await this.parts.runtime.callAsync(ShellMethods.quitAnswered, new QuitAnswered(answer).toJson());
  }

  private async readWorkAsync(): Promise<WorkReport | null> {
    const connection = this.parts.startup.connection;
    if (Object.isNull(connection))
      return null;
    try {
      const response = await connection.callAsync(ShellMethods.work, null, Resources.workQueryTimeout);
      return response.hasFailed ? null : WorkReport.fromJson(response.payload);
    }
    catch (error) {
      this.log(Resources.formatWorkNotRead(String(error)));
      return null;
    }
  }

  private async saveAllAsync(): Promise<boolean> {
    const saved = await Promise.all(this.parts.windows.all.map(t => t.saveAsync()));
    return saved.every(t => t);
  }

  private async stopAsync(policy: StopPolicy): Promise<boolean> {
    const failure = (await this.parts.runtime.callAsync(ShellMethods.stop, new StopRequest(policy, true).toJson())).failure;
    if (Object.isUndefined(failure) || failure.code === FailureCode.Disconnected)
      return false;
    if (failure.code === FailureCode.Conflict && policy === StopPolicy.IfIdle)
      return true;
    this.log(Resources.formatRuntimeNotStopped(failure.message));
    return false;
  }
}
