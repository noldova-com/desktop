/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { WindowStateUnavailableException } from "../exceptions/window-state-unavailable.exception.js";
import type { ICloseGuard } from "../interfaces/i-close-guard.js";
import type { IMainProcessLog } from "../interfaces/i-main-process-log.js";
import type { IMainProcessWindow } from "../interfaces/i-main-process-window.js";
import type { IDisplayHost } from "../interfaces/i-display-host.js";
import type { IQuitPrompt } from "../interfaces/i-quit-prompt.js";
import type { QuitQuestion } from "../models/quit-question.js";
import { Resources } from "../resources.js";
import { CloseCoordinator } from "./close-coordinator.js";
import { UpdateSaveCoordinator } from "./update-save-coordinator.js";
import { WindowBoundsKeeper } from "./window-bounds-keeper.js";
import { WindowErrorLimit } from "./window-error-limit.js";

export class OpenWindow implements IQuitPrompt {
  private readonly log: IMainProcessLog;
  private readonly guard: ICloseGuard;
  private readonly painted: PromiseWithResolvers<boolean> = Promise.withResolvers<boolean>();
  private readonly pagePainted: PromiseWithResolvers<boolean> = Promise.withResolvers<boolean>();
  private readonly openedAt: number = Date.now();
  private closing: Promise<void> | undefined;
  private canClose: boolean = false;
  private isPainted: boolean = false;
  private hasPagePainted: boolean = false;
  private isSettled: boolean = false;
  private isReady: boolean = false;
  private settleTimer: NodeJS.Timeout | undefined;
  private paintTimer: NodeJS.Timeout | undefined;

  public readonly window: IMainProcessWindow;
  public readonly coordinator: CloseCoordinator;
  public readonly updateSaves: UpdateSaveCoordinator;
  public readonly bounds: WindowBoundsKeeper;
  public readonly errors: WindowErrorLimit = new WindowErrorLimit(Resources.windowErrorBurst, Resources.windowErrorPeriod);

  public constructor(window: IMainProcessWindow, displays: IDisplayHost, log: IMainProcessLog, guard: ICloseGuard, platform: string, isPlacedByCompositor: boolean = false) {
    this.window = window;
    this.log = log;
    this.guard = guard;
    this.coordinator = new CloseCoordinator(t => this.sendRequest(Resources.closeRequestChannel, t), Resources.closeAnswerTimeout);
    this.updateSaves = new UpdateSaveCoordinator(t => this.sendRequest(Resources.updateSaveRequestChannel, t), Resources.closeAnswerTimeout);
    this.bounds = new WindowBoundsKeeper(window, displays, Resources.boundsSaveDelay, log, platform === Resources.windowsPlatform, isPlacedByCompositor);
    this.closing = undefined;
    this.settleTimer = undefined;
    this.paintTimer = undefined;
    window.on(Resources.enterFullScreenEvent, () => window.webContents.send(Resources.fullScreenChannel, true));
    window.on(Resources.leaveFullScreenEvent, () => window.webContents.send(Resources.fullScreenChannel, false));
    window.on(Resources.maximizeEvent, () => window.webContents.send(Resources.maximizedChannel, true));
    window.on(Resources.unmaximizeEvent, () => window.webContents.send(Resources.maximizedChannel, false));
    window.on(Resources.closeEvent, event => {
      if (this.canClose)
        return;
      event.preventDefault();
      this.closing ??= this.closeWhenSavedAsync();
    });
    window.once(Resources.closedEvent, () => {
      this.painted.resolve(false);
      this.pagePainted.resolve(false);
      this.stopSettleTimer();
      this.stopPaintTimer();
      this.bounds.cancelSave();
      this.coordinator.release();
      this.updateSaves.release();
    });
  }

  public get isPagePainted(): boolean {
    return this.hasPagePainted;
  }

  public markPainted(): void {
    this.stopPaintTimer();
    if (this.isPainted && !this.hasPagePainted)
      this.log.write(Resources.formatPagePaintedLate((Date.now() - this.openedAt) / Resources.millisecondsPerSecond));
    this.isPainted = true;
    this.hasPagePainted = true;
    this.painted.resolve(true);
    this.pagePainted.resolve(true);
    this.showWhenReady();
  }

  public whenPaintedAsync(): Promise<boolean> {
    return this.painted.promise;
  }

  public whenPagePaintedAsync(): Promise<boolean> {
    return this.pagePainted.promise;
  }

  public showUnpaintedWithin(milliseconds: number): void {
    this.paintTimer = setTimeout(() => this.showUnpainted(milliseconds), milliseconds).unref();
  }

  public showNow(): void {
    this.stopPaintTimer();
    this.isPainted = true;
    this.painted.resolve(true);
    this.settle();
  }

  public settleWithin(milliseconds: number): void {
    this.settleTimer = setTimeout(() => this.settle(), milliseconds);
  }

  public settle(): void {
    this.stopSettleTimer();
    this.isSettled = true;
    this.showWhenReady();
  }

  public focus(): void {
    if (!this.isReady)
      return;
    if (this.window.isMinimized())
      this.window.restore();
    this.window.focus();
  }

  public show(question: QuitQuestion | null): boolean {
    if (this.window.isDestroyed() || this.window.webContents.isCrashed())
      return false;
    this.window.webContents.send(Resources.quitQuestionChannel, question?.toJson() ?? null);
    return true;
  }

  public async saveAsync(): Promise<boolean> {
    if (!await this.coordinator.requestAsync())
      return false;
    if (this.window.isDestroyed())
      return true;
    await this.bounds.saveAsync().catch((error: unknown) => this.log.write(error instanceof WindowStateUnavailableException
      ? Resources.formatBoundsLostAtClose(error.message)
      : Resources.formatBoundsUnsaved(String(error))));
    return true;
  }

  public closeNow(): void {
    if (this.window.isDestroyed())
      return;
    this.canClose = true;
    this.window.close();
  }

  private showUnpainted(milliseconds: number): void {
    const contents = this.window.webContents;
    this.log.write(Resources.formatWindowShownUnpainted(milliseconds / Resources.millisecondsPerSecond, contents.isLoading(), contents.isCrashed()));
    this.showNow();
  }

  private stopPaintTimer(): void {
    if (!Object.isUndefined(this.paintTimer))
      clearTimeout(this.paintTimer);
    this.paintTimer = undefined;
  }

  private stopSettleTimer(): void {
    if (!Object.isUndefined(this.settleTimer))
      clearTimeout(this.settleTimer);
    this.settleTimer = undefined;
  }

  private showWhenReady(): void {
    if (!this.isPainted || !this.isSettled || this.window.isDestroyed())
      return;
    this.isReady = true;
    if (!this.window.isVisible())
      this.bounds.show();
  }

  private async closeWhenSavedAsync(): Promise<void> {
    const canClose = await this.guard.canCloseAsync(this) && await this.saveAsync();
    this.closing = undefined;
    if (canClose)
      this.closeNow();
  }

  private sendRequest(channel: string, requestId: string): boolean {
    if (this.window.isDestroyed() || this.window.webContents.isCrashed())
      return false;
    this.window.webContents.send(channel, requestId);
    return true;
  }
}
