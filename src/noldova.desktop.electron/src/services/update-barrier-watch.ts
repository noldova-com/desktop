/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FSWatcher, watch } from "node:fs";

import "@noldova/context.core";
import { RuntimeBuild, type UpdateBarrier, UpdateBarrierState } from "@noldova/desktop.runtime";

import type { IUpdateHost } from "../interfaces/i-update-host.js";
import { ErrorCode } from "../models/error-code.js";
import { Resources } from "../resources.js";
import { UpdateBridge } from "./update-bridge.js";

export class UpdateBarrierWatch {
  private readonly updates: Pick<IUpdateHost, "processId" | "readBarrierAsync" | "hasUpdateEndedAsync" | "quit">;
  private readonly folder: string;
  private readonly isConnected: () => boolean;
  private readonly onChange: () => void;
  private readonly log: (text: string) => void;
  private readonly now: () => number;
  private readonly schedule: (wait: number, run: () => void) => () => void;
  private watcher: FSWatcher | null = null;
  private isChecking: boolean = false;
  private isStale: boolean = false;
  private isStaleLost: boolean = false;
  private recheck: (() => void) | null = null;
  private isRecheckDue: boolean = false;
  private isStopped: boolean = false;
  private rechecks: number = 0;
  private firstFailure: number = 0;

  public constructor(updates: Pick<IUpdateHost, "processId" | "readBarrierAsync" | "hasUpdateEndedAsync" | "quit">, folder: string, isConnected: () => boolean,
    onChange: () => void, log: (text: string) => void, now: () => number = Date.now,
    schedule: (wait: number, run: () => void) => () => void = UpdateBridge.schedule) {
    this.updates = updates;
    this.folder = folder;
    this.isConnected = isConnected;
    this.onChange = onChange;
    this.log = log;
    this.now = now;
    this.schedule = schedule;
  }

  public start(): void {
    this.isStopped = false;
    if (!Object.isNull(this.watcher))
      return;
    let watcher: FSWatcher;
    try {
      watcher = watch(this.folder, { persistent: false }, () => this.change());
    }
    catch (error) {
      this.log(Resources.formatBarrierUnwatched(String(error)));
      return;
    }
    watcher.once(Resources.errorEvent, (error: Error) => this.fail(error));
    this.watcher = watcher;
    void this.checkAsync();
  }

  public stop(): void {
    this.isStopped = true;
    this.closeWatcher();
    if (!Object.isNull(this.recheck))
      this.recheck();
    this.recheck = null;
  }

  public async checkAsync(): Promise<boolean> {
    let isLost = !this.isConnected();
    if (this.isChecking) {
      this.isStale = true;
      this.isStaleLost ||= isLost;
      return false;
    }
    this.isChecking = true;
    try {
      do {
        this.isStale = false;
        this.isStaleLost = false;
        if (await this.isClosingAsync(isLost) && !this.isStopped) {
          this.stop();
          this.updates.quit();
          return true;
        }
        isLost = this.isStaleLost;
      } while (this.isStale);
      return false;
    }
    finally {
      this.isChecking = false;
    }
  }

  private change(): void {
    this.onChange();
    void this.checkAsync();
  }

  private async isClosingAsync(isLost: boolean): Promise<boolean> {
    const isRecheck = this.isRecheckDue;
    this.isRecheckDue = false;
    if (!isLost) {
      this.rechecks = 0;
      return false;
    }
    try {
      const barrier = await this.updates.readBarrierAsync();
      const isClosing = !Object.isNull(barrier) && UpdateBarrierWatch.isReplacing(barrier) && barrier.holder.processId !== this.updates.processId
        && !await this.updates.hasUpdateEndedAsync();
      this.rechecks = 0;
      return isClosing;
    }
    catch (error) {
      this.checkLater(error, isRecheck);
      return false;
    }
  }

  private checkLater(error: unknown, isRecheck: boolean): void {
    if (this.isStopped)
      return;
    if (!ErrorCode.isOneOf(error, Resources.barrierRecheckCodes)) {
      this.log(Resources.formatBarrierUnchecked(String(error)));
      return;
    }
    if (!Object.isNull(this.recheck)) {
      this.log(Resources.formatBarrierRecheckPlanned(String(error)));
      return;
    }
    if (isRecheck)
      this.rechecks += 1;
    else {
      this.rechecks = 0;
      this.firstFailure = this.now();
    }
    if (this.rechecks >= Resources.barrierRecheckLimit || this.now() - this.firstFailure >= Resources.barrierRecheckDeadline) {
      this.log(Resources.formatBarrierRechecksEnded(String(error)));
      return;
    }
    const delay = Resources.barrierRecheckDelay * 2 ** this.rechecks;
    this.log(Resources.formatBarrierRechecked(delay, String(error)));
    this.recheck = this.schedule(delay, () => {
      this.recheck = null;
      this.isRecheckDue = true;
      void this.checkAsync();
    });
  }

  private closeWatcher(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private static isReplacing(barrier: UpdateBarrier): boolean {
    return barrier.state === UpdateBarrierState.Closing || (barrier.state === UpdateBarrierState.HandedOff && barrier.version !== RuntimeBuild.identity.productVersion);
  }

  private fail(error: Error): void {
    this.closeWatcher();
    this.log(Resources.formatBarrierUnwatched(String(error)));
  }
}
