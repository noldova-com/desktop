/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { type FSWatcher } from "node:fs";
import { syncBuiltinESMExports } from "node:module";

export class WatchLimitFixture implements Disposable {
  private readonly watch: typeof fs.watch = fs.watch;

  public constructor() {
    fs.watch = ((folder: fs.PathLike): FSWatcher => {
      throw Object.assign(new Error(`ENOSPC: System limit for number of file watchers reached, watch '${String(folder)}'`), { code: "ENOSPC" });
    }) as typeof fs.watch;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.watch = this.watch;
    syncBuiltinESMExports();
  }
}
