/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { type FSWatcher, type WatchListener } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

import "@noldova/context.core";

export class WatchPathsFixture implements Disposable {
  private readonly restore: () => void;

  public readonly paths: string[] = [];
  public onWatch: (target: string) => void = () => undefined;
  public dropsEvents: boolean = false;

  public constructor() {
    const watch = fs.watch;
    const watching = mock.method(fs, "watch", (target: fs.PathLike, listener: WatchListener<string>): FSWatcher => {
      this.paths.push(String(target));
      this.onWatch(String(target));
      return watch(target, this.dropsEvents ? () => undefined : listener);
    });
    this.restore = () => watching.mock.restore();
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    this.restore();
    syncBuiltinESMExports();
  }
}
