/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type BigIntStats, type FSWatcher, watch } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { IProfileWatch } from "../../interfaces/i-profile-watch.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";

export class ProfileWatch implements IProfileWatch {
  private readonly home: string;
  private readonly names: readonly string[];
  private readonly onChange: () => void;
  private readonly diagnostics: Writable;
  private readonly watchFolder: (folder: string, listener: (event: string, name: string | null) => void) => FSWatcher;
  private readonly findTarget: (file: string) => Promise<string | null>;
  private readonly stat: (folder: string) => Promise<Pick<BigIntStats, "dev" | "ino"> | undefined>;
  private readonly watchers: Map<string, readonly [FSWatcher, string]> = new Map();
  private readonly waiting: Map<string, FSWatcher> = new Map();
  private readonly failing: Set<string> = new Set();
  private readonly retried: Set<string> = new Set();
  private readonly unwatched: Set<string> = new Set();
  private profiles: readonly string[] = [];
  private files: ReadonlySet<string> = new Set();
  private queue: Promise<unknown> = Promise.resolve();
  private isDisposed: boolean = false;

  private constructor(home: string, names: readonly string[], onChange: () => void, diagnostics: Writable,
    watchFolder: (folder: string, listener: (event: string, name: string | null) => void) => FSWatcher, findTarget: (file: string) => Promise<string | null>,
    stat: (folder: string) => Promise<Pick<BigIntStats, "dev" | "ino"> | undefined>) {
    this.home = home;
    this.names = names;
    this.onChange = onChange;
    this.diagnostics = diagnostics;
    this.watchFolder = watchFolder;
    this.findTarget = findTarget;
    this.stat = stat;
  }

  public static start(home: string, zshFolder: string | undefined, names: readonly string[], onChange: () => void, diagnostics: Writable,
    watchFolder: (folder: string, listener: (event: string, name: string | null) => void) => FSWatcher = (t, u) => watch(t, { persistent: false }, u),
    findTarget: (file: string) => Promise<string | null> = ProfileWatch.findTargetAsync,
    stat: (folder: string) => Promise<Pick<BigIntStats, "dev" | "ino"> | undefined> = ProfileWatch.statAsync): ProfileWatch {
    const started = new ProfileWatch(home, names, onChange, diagnostics, watchFolder, findTarget, stat);
    void started.followAsync(zshFolder);
    return started;
  }

  public followAsync(zshFolder: string | undefined): Promise<boolean> {
    return this.serialize(() => {
      this.profiles = [...new Set([this.home, zshFolder ?? this.home])].flatMap(t => this.names.map(u => path.join(t, u)));
      return this.updateAsync();
    });
  }

  public readStampAsync(): Promise<string> {
    return this.serialize(async () => {
      const stamps: [string, readonly string[] | null][] = [];
      for (const file of [...this.files].sort())
        stamps.push([file, await ProfileWatch.stampAsync(file)]);
      return JSON.stringify(stamps);
    });
  }

  public [Symbol.dispose](): void {
    this.isDisposed = true;
    for (const [watcher] of this.watchers.values())
      watcher.close();
    for (const watcher of this.waiting.values())
      watcher.close();
    this.watchers.clear();
    this.waiting.clear();
  }

  private serialize<T>(work: () => T | Promise<T>): Promise<T> {
    const run = this.queue.then(work);
    this.queue = run;
    return run;
  }

  private onEvent(work: () => void | Promise<void>): void {
    void this.serialize(async () => {
      if (!this.isDisposed)
        await work();
    });
  }

  private async updateAsync(): Promise<boolean> {
    if (this.isDisposed)
      return false;
    const files: string[] = [];
    for (const profile of this.profiles) {
      const target = await this.findTarget(profile);
      files.push(...Object.isNull(target) ? [profile] : [profile, target]);
    }
    const folders = new Set(files.map(t => path.dirname(t)));
    this.files = new Set(files);
    const closed = [...this.watchers].filter(([t]) => !folders.has(t));
    for (const [folder, [watcher]] of closed)
      this.close(folder, watcher);
    const stopped = [...this.waiting].filter(([t]) => !folders.has(t));
    for (const [folder, watcher] of stopped)
      this.stopWaiting(folder, watcher);
    for (const folder of [...closed.map(([t]) => t), ...stopped.map(([t]) => t), ...this.watchers.keys()]) {
      this.failing.delete(folder);
      this.retried.delete(folder);
    }
    const found: [string, FSWatcher][] = [];
    for (const [folder, watcher] of [...this.waiting])
      if (!Object.isUndefined(await this.identifyAsync(folder)))
        found.push([folder, watcher]);
    for (const [folder, watcher] of found)
      this.stopWaiting(folder, watcher);
    const opened: string[] = [];
    for (const folder of [...folders].filter(t => !this.watchers.has(t) && !this.waiting.has(t)))
      if (await this.openAsync(folder))
        opened.push(folder);
    return closed.length > 0 || stopped.length > 0 || found.length > 0 || opened.length > 0;
  }

  private async openAsync(folder: string, isAgain: boolean = false): Promise<boolean> {
    const identity = await this.identifyAsync(folder);
    if (this.isDisposed)
      return false;
    let watcher: FSWatcher;
    try {
      watcher = this.watchFolder(folder, (_event, name) => this.onEvent(() => this.changedAsync(folder, watcher, String(name))));
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.unwatchableFolderCodes))
        throw error;
      return await this.waitAsync(folder);
    }
    if (Object.isUndefined(identity)) {
      watcher.close();
      return isAgain ? await this.waitAsync(folder) : await this.openAsync(folder, true);
    }
    watcher.once(Resources.errorEvent, () => this.onEvent(() => this.fail(folder, watcher)));
    this.watchers.set(folder, [watcher, identity]);
    this.unwatched.delete(folder);
    if (this.retried.has(folder))
      return false;
    if (this.failing.has(folder))
      this.retried.add(folder);
    return true;
  }

  private async waitAsync(folder: string): Promise<boolean> {
    if (!Object.isUndefined(await this.identifyAsync(folder)))
      return this.unwatch(folder);
    let parent = path.dirname(folder);
    while (Object.isUndefined(await this.identifyAsync(parent)) && parent !== path.dirname(parent))
      parent = path.dirname(parent);
    if (this.isDisposed)
      return false;
    const next = path.relative(parent, folder).split(path.sep)[0];
    let watcher: FSWatcher;
    try {
      watcher = this.watchFolder(parent, (_event, name) => {
        if (name === next || name === path.basename(parent))
          this.onEvent(() => this.appearedAsync(folder, watcher));
      });
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.unwatchableFolderCodes))
        throw error;
      return this.unwatch(folder);
    }
    watcher.once(Resources.errorEvent, () => this.onEvent(() => {
      this.stopWaiting(folder, watcher);
      this.unwatch(folder);
    }));
    this.waiting.set(folder, watcher);
    if (Object.isUndefined(await this.identifyAsync(folder)))
      return true;
    this.stopWaiting(folder, watcher);
    return await this.openAsync(folder);
  }

  private async appearedAsync(folder: string, watcher: FSWatcher): Promise<void> {
    this.stopWaiting(folder, watcher);
    await this.updateAsync();
    this.onChange();
  }

  private fail(folder: string, watcher: FSWatcher): void {
    this.close(folder, watcher);
    this.unwatch(folder);
    if (this.failing.has(folder))
      return;
    this.failing.add(folder);
    this.onChange();
  }

  private close(folder: string, watcher: FSWatcher): void {
    if (this.watchers.get(folder)?.[0] === watcher)
      this.watchers.delete(folder);
    watcher.close();
  }

  private stopWaiting(folder: string, watcher: FSWatcher): void {
    if (this.waiting.get(folder) === watcher)
      this.waiting.delete(folder);
    watcher.close();
  }

  private unwatch(folder: string): false {
    if (!this.unwatched.has(folder)) {
      this.unwatched.add(folder);
      this.diagnostics.write(Resources.profilesUnwatched);
    }
    return false;
  }

  private async changedAsync(folder: string, watcher: FSWatcher, name: string): Promise<void> {
    if (name === path.basename(folder) && await this.identifyAsync(folder) !== this.watchers.get(folder)?.[1]) {
      this.close(folder, watcher);
      this.onChange();
      return;
    }
    const file = path.join(folder, name);
    if (!this.files.has(file))
      return;
    if (this.profiles.includes(file))
      await this.updateAsync();
    this.onChange();
  }

  private async identifyAsync(folder: string): Promise<string | undefined> {
    const stats = await this.stat(folder);
    return Object.isUndefined(stats) ? undefined : Resources.formatFileKey(stats.dev, stats.ino);
  }

  private static async statAsync(folder: string): Promise<BigIntStats | undefined> {
    try {
      return await stat(folder, { bigint: true });
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.unreadablePathCodes))
        throw error;
      return undefined;
    }
  }

  private static async stampAsync(file: string): Promise<readonly string[] | null> {
    try {
      const stats = await stat(file, { bigint: true });
      return [stats.dev, stats.ino, stats.size, stats.mtimeNs, stats.ctimeNs].map(String);
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.unreadablePathCodes))
        throw error;
      return null;
    }
  }

  private static async findTargetAsync(file: string): Promise<string | null> {
    try {
      return (await lstat(file)).isSymbolicLink() ? await realpath(file) : null;
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.unreadablePathCodes))
        throw error;
      return null;
    }
  }
}
