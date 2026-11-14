/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

export class FolderWatchFixture implements Disposable {
  private readonly watch: typeof fs.watch = fs.watch;
  private readonly watchers: fs.FSWatcher[] = [];

  public closed: number = 0;

  public constructor(folder: string) {
    const watch = this.watch;
    fs.watch = ((...values: Parameters<typeof fs.watch>): fs.FSWatcher => {
      const watcher = watch(...values);
      const [target] = values;
      if (String(target) === folder) {
        this.watchers.push(watcher);
        watcher.once("close", () => this.closed++);
      }
      return watcher;
    }) as typeof fs.watch;
    syncBuiltinESMExports();
  }

  public get count(): number {
    return this.watchers.length;
  }

  public change(): void {
    for (const watcher of this.watchers)
      watcher.emit("change", "rename", "barrier.json");
  }

  public fail(message: string): void {
    for (const watcher of this.watchers)
      watcher.emit("error", new Error(message));
  }

  public [Symbol.dispose](): void {
    fs.watch = this.watch;
    syncBuiltinESMExports();
  }
}
