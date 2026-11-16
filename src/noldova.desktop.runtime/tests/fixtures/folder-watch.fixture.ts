/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

export class FolderWatchFixture implements Disposable {
  private readonly restore: () => void;
  private readonly watchers: fs.FSWatcher[] = [];

  public constructor(folder: string) {
    const watch = fs.watch;
    const watching = mock.method(fs, "watch", (...values: Parameters<typeof fs.watch>): fs.FSWatcher => {
      const watcher = watch(...values);
      const [target] = values;
      if (String(target) === folder)
        this.watchers.push(watcher);
      return watcher;
    });
    this.restore = () => watching.mock.restore();
    syncBuiltinESMExports();
  }

  public get count(): number {
    return this.watchers.length;
  }

  public change(name: string, times: number): void {
    for (const watcher of this.watchers)
      for (let time = 0; time < times; time++)
        watcher.emit("change", "change", name);
  }

  public fail(message: string): void {
    for (const watcher of this.watchers)
      watcher.emit("error", new Error(message));
  }

  public [Symbol.dispose](): void {
    this.restore();
    syncBuiltinESMExports();
  }
}
