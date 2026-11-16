/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BigIntStats, PathLike, StatOptions, Stats } from "node:fs";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

export class FailedStatFixture implements Disposable {
  private readonly stat: typeof fs.stat = fs.stat;
  private readonly lstat: typeof fs.lstat = fs.lstat;

  public constructor(file: string, failure: Error) {
    const stat = this.stat;
    const lstat = this.lstat;
    Object.assign(fs, {
      stat: (target: PathLike, options?: StatOptions): Promise<Stats | BigIntStats | undefined> => String(target) === file ? Promise.reject(failure) : stat(target, options),
      lstat: (target: PathLike, options?: StatOptions): Promise<Stats | BigIntStats | undefined> => String(target) === file ? Promise.reject(failure) : lstat(target, options)
    });
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.stat = this.stat;
    fs.lstat = this.lstat;
    syncBuiltinESMExports();
  }
}
