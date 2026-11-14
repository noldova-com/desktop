/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FSWatcher, watch } from "node:fs";

import "@noldova/context.core";
import { UpdateBarrierState } from "@noldova/desktop.runtime";

import type { IUpdateHost } from "../interfaces/i-update-host.js";
import { Resources } from "../resources.js";

export class UpdateBarrierWatch {
  private readonly updates: Pick<IUpdateHost, "processId" | "readBarrierAsync" | "hasUpdateEndedAsync" | "quit">;
  private readonly folder: string;
  private readonly isConnected: () => boolean;
  private readonly onChange: () => void;
  private readonly log: (text: string) => void;
  private watcher: FSWatcher | null = null;
  private isChecking: boolean = false;
  private isStale: boolean = false;

  public constructor(updates: Pick<IUpdateHost, "processId" | "readBarrierAsync" | "hasUpdateEndedAsync" | "quit">, folder: string, isConnected: () => boolean,
    onChange: () => void, log: (text: string) => void) {
    this.updates = updates;
    this.folder = folder;
    this.isConnected = isConnected;
    this.onChange = onChange;
    this.log = log;
  }

  public start(): void {
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
    this.watcher?.close();
    this.watcher = null;
  }

  public async checkAsync(): Promise<boolean> {
    if (this.isChecking) {
      this.isStale = true;
      return false;
    }
    this.isChecking = true;
    try {
      do {
        this.isStale = false;
        if (await this.isClosingAsync()) {
          this.stop();
          this.updates.quit();
          return true;
        }
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

  private async isClosingAsync(): Promise<boolean> {
    if (this.isConnected())
      return false;
    const barrier = await this.updates.readBarrierAsync().catch(() => null);
    return barrier?.state === UpdateBarrierState.Closing && barrier.holder.processId !== this.updates.processId && !await this.updates.hasUpdateEndedAsync().catch(() => true);
  }

  private fail(error: Error): void {
    this.stop();
    this.log(Resources.formatBarrierUnwatched(String(error)));
  }
}
