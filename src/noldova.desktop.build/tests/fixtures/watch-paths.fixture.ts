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

export class WatchPathsFixture implements Disposable {
  private readonly watch: typeof fs.watch = fs.watch;

  public readonly paths: string[] = [];
  public onWatch: (target: string) => void = () => undefined;

  public constructor() {
    const watch = this.watch;
    fs.watch = ((target: fs.PathLike, listener: WatchListener<string>): FSWatcher => {
      this.paths.push(String(target));
      this.onWatch(String(target));
      return watch(target, listener);
    }) as typeof fs.watch;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.watch = this.watch;
    syncBuiltinESMExports();
  }
}
