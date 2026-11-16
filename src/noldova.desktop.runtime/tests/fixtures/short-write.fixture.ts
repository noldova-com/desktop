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

import "@noldova/context.core";

type WriteCallback = (failure: NodeJS.ErrnoException | null, written: number, text: Buffer) => void;

export class ShortWriteFixture implements Disposable {
  private readonly restore: () => void;

  public readonly lengths: number[] = [];

  public constructor() {
    const write = fs.write;
    const replaced = mock.method(fs, "write", (handle: number, text: Buffer, callback: WriteCallback): void => {
      this.lengths.push(text.length);
      write(handle, text.subarray(0, Math.ceil(text.length / 2)), callback);
    });
    this.restore = () => replaced.mock.restore();
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    this.restore();
    syncBuiltinESMExports();
  }
}
