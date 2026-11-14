/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FSWatcher, watch } from "node:fs";

import "@noldova/context.core";

import { Resources } from "../resources.js";

export class InstallationWatch implements Disposable {
  private readonly folder: string;
  private readonly log: (text: string) => void;
  private readonly checkInterval: number;
  private watcher: FSWatcher | null = null;
  private failure: string | null = null;
  private isLogged: boolean = false;
  private isChanged: boolean = false;
  private wake: (() => void) | null = null;

  public constructor(folder: string, log: (text: string) => void, checkInterval: number = Resources.updateCheckInterval) {
    this.folder = folder;
    this.log = log;
    this.checkInterval = checkInterval;
    try {
      const watcher = watch(folder, () => this.signal());
      watcher.once(Resources.errorEvent, (error: Error) => this.fail(error));
      this.watcher = watcher;
    }
    catch (error) {
      this.failure = String(error);
    }
  }

  public async waitAsync(timeout: number): Promise<void> {
    this.report();
    let timer: NodeJS.Timeout | undefined;
    try {
      await new Promise<void>(t => {
        this.wake = t;
        if (this.isChanged) {
          t();
          return;
        }
        timer = setTimeout(t, Math.max(Math.min(timeout, this.checkInterval), 0));
      });
    }
    finally {
      clearTimeout(timer);
      this.wake = null;
    }
    this.isChanged = false;
    this.report();
  }

  public [Symbol.dispose](): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private signal(): void {
    this.isChanged = true;
    this.wake?.();
  }

  private fail(error: Error): void {
    this[Symbol.dispose]();
    this.failure = String(error);
    this.wake?.();
  }

  private report(): void {
    if (Object.isNull(this.failure) || this.isLogged)
      return;
    this.isLogged = true;
    this.log(Resources.formatInstallationUnwatched(this.folder, this.checkInterval, this.failure));
  }
}
