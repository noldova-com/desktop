/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { type FSWatcher, type WatchListener } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

import "@noldova/context.core";

export class WatchPatchFixture implements Disposable {
  private readonly watch: typeof fs.watch = fs.watch;
  private readonly listeners: WatchListener<string>[] = [];

  public readonly folders: string[] = [];
  public readonly watchers: FSWatcher[] = [];
  public onWatch: (folder: string) => void = () => undefined;

  public constructor(allowed: number = Number.POSITIVE_INFINITY, isQuiet: boolean = false) {
    const watch = this.watch;
    fs.watch = ((folder: fs.PathLike, listener: WatchListener<string>): FSWatcher => {
      this.onWatch(String(folder));
      this.folders.push(String(folder));
      if (this.folders.length > allowed)
        throw Object.assign(new Error(`ENOSPC: System limit for number of file watchers reached, watch '${String(folder)}'`), { code: "ENOSPC" });
      const watcher = isQuiet ? watch(folder) : watch(folder, listener);
      this.watchers.push(watcher);
      this.listeners.push(listener);
      return watcher;
    }) as typeof fs.watch;
    syncBuiltinESMExports();
  }

  public static quiet(): WatchPatchFixture {
    return new WatchPatchFixture(Number.POSITIVE_INFINITY, true);
  }

  public change(): void {
    this.listeners.at(-1)?.("change", "runtime.json");
  }

  public fail(error: Error): void {
    this.watchers.at(-1)?.emit("error", error);
  }

  public [Symbol.dispose](): void {
    fs.watch = this.watch;
    syncBuiltinESMExports();
  }
}
