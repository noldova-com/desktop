/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

import "@noldova/context.core";

export class SyncFlushFixture implements Disposable {
  private readonly fsync: typeof fs.fsyncSync = fs.fsyncSync;
  private failure: string | null = null;

  public readonly flushes: string[] = [];

  public constructor(observe: () => string) {
    const fsync = this.fsync;
    fs.fsyncSync = (descriptor: number): void => {
      this.flushes.push(observe());
      const failure = this.failure;
      this.failure = null;
      if (!Object.isNull(failure))
        throw Object.assign(new Error(`${failure}: failed by the test`), { code: failure });
      fsync(descriptor);
    };
    syncBuiltinESMExports();
  }

  public failOnce(code: string): void {
    this.failure = code;
  }

  public [Symbol.dispose](): void {
    fs.fsyncSync = this.fsync;
    syncBuiltinESMExports();
  }
}
