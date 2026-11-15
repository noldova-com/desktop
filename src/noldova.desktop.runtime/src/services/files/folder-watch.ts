/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, type FSWatcher, statSync, watch } from "node:fs";
import path from "node:path";

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class FolderWatch implements Disposable {
  private readonly target: string;
  private readonly checkInterval: number;
  private readonly log: (text: string) => void;
  private watched: string;
  private watcher: FSWatcher | null = null;
  private stamp: number | null = null;
  private isChanged: boolean = false;
  private isChecking: boolean = false;
  private wake: (() => void) | null = null;

  private constructor(target: string, log: (text: string) => void, checkInterval: number) {
    this.target = target;
    this.log = log;
    this.checkInterval = checkInterval;
    this.watched = FolderWatch.findWatched(target);
    try {
      this.stamp = FolderWatch.readStamp(target);
      this.watcher = this.start(this.watched);
      this.isChanged = this.follow();
    }
    catch (error) {
      this.fail(error);
    }
  }

  public static open(folder: string, log: (text: string) => void, checkInterval: number = Resources.launchCheckInterval): FolderWatch {
    return new FolderWatch(path.resolve(folder), log, checkInterval);
  }

  private static findWatched(target: string): string {
    for (let folder = target; ; folder = path.dirname(folder)) {
      if (existsSync(folder) || path.dirname(folder) === folder)
        return folder;
    }
  }

  private static readStamp(folder: string): number | null {
    return statSync(folder, { throwIfNoEntry: false })?.mtimeMs ?? null;
  }

  public async waitAsync(timeout: number, isDone: () => boolean): Promise<boolean> {
    let deadline: NodeJS.Timeout | undefined;
    let check: NodeJS.Timeout | undefined;
    let isWoken: boolean;
    try {
      isWoken = await new Promise<boolean>((resolve, reject) => {
        this.wake = () => resolve(true);
        if (this.isChanged) {
          resolve(true);
          return;
        }
        deadline = setTimeout(() => resolve(false), Math.max(timeout, 0));
        check = setInterval(() => {
          try {
            if (isDone() || this.isChecking || FolderWatch.readStamp(this.target) !== this.stamp)
              resolve(true);
          }
          catch (error) {
            reject(error);
          }
        }, this.checkInterval);
      });
    }
    finally {
      clearTimeout(deadline);
      clearInterval(check);
      this.wake = null;
    }
    this.isChanged = false;
    this.stamp = FolderWatch.readStamp(this.target);
    return isWoken;
  }

  public [Symbol.dispose](): void {
    this.close();
  }

  private start(folder: string): FSWatcher {
    const watcher = watch(folder, () => this.signal());
    watcher.on(Resources.errorEvent, (error: unknown) => this.fail(error));
    return watcher;
  }

  private close(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private signal(): void {
    try {
      this.follow();
    }
    catch (error) {
      this.fail(error);
      return;
    }
    this.isChanged = true;
    this.wake?.();
  }

  private follow(): boolean {
    let isMoved = false;
    for (let folder = FolderWatch.findWatched(this.target); folder !== this.watched; folder = FolderWatch.findWatched(this.target)) {
      const watcher = this.start(folder);
      this.close();
      this.watcher = watcher;
      this.watched = folder;
      isMoved = true;
    }
    return isMoved;
  }

  private fail(error: unknown): void {
    if (this.isChecking)
      return;
    this.isChecking = true;
    this.close();
    this.log(Resources.formatFolderWatchFallback(this.target, this.checkInterval, String(error)));
    this.wake?.();
  }
}
