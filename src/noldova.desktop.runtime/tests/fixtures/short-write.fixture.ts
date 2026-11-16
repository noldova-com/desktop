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

type WriteCallback = (failure: NodeJS.ErrnoException | null, written: number, text: Buffer) => void;

export class ShortWriteFixture implements Disposable {
  private readonly write: typeof fs.write = fs.write;

  public readonly lengths: number[] = [];

  public constructor() {
    const write = this.write;
    fs.write = ((handle: number, text: Buffer, callback: WriteCallback): void => {
      this.lengths.push(text.length);
      write(handle, text.subarray(0, Math.ceil(text.length / 2)), callback);
    }) as typeof fs.write;
    syncBuiltinESMExports();
  }

  public [Symbol.dispose](): void {
    fs.write = this.write;
    syncBuiltinESMExports();
  }
}
