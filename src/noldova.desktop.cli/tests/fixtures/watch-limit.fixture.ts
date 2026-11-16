/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs, { type FSWatcher } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

export class WatchLimitFixture implements Disposable {
  private readonly restore: () => void;

  public constructor() {
    const watching = mock.method(fs, "watch", (folder: fs.PathLike): FSWatcher => {
      throw Object.assign(new Error(`ENOSPC: System limit for number of file watchers reached, watch '${String(folder)}'`), { code: "ENOSPC" });
    });
    this.restore = () => watching.mock.restore();
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    this.restore();
    syncBuiltinESMExports();
  }
}
