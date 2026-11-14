/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Mode, PathLike } from "node:fs";
import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

import "@noldova/context.core";

export class HeldOpenFixture implements Disposable {
  private readonly open: typeof fs.open = fs.open;
  private readonly gate: Promise<void>;
  private settle: (error: Error | null) => void = () => undefined;

  public readonly held: string[] = [];
  public settled: number = 0;

  public constructor(prefix: string) {
    const open = this.open;
    this.gate = new Promise((resolve, reject) => {
      this.settle = error => Object.isNull(error) ? resolve() : reject(error);
    });
    void this.gate.catch(() => undefined);
    fs.open = async (file: PathLike, flags?: string | number, mode?: Mode): Promise<fs.FileHandle> => {
      if (!String(file).startsWith(prefix))
        return await open(file, flags, mode);
      this.held.push(String(file));
      try {
        await this.gate;
        return await open(file, flags, mode);
      }
      finally {
        this.settled += 1;
      }
    };
    syncBuiltinESMExports();
  }

  public release(): void {
    this.settle(null);
  }

  public fail(code: string): void {
    this.settle(Object.assign(new Error(`${code}: held by the test`), { code }));
  }

  public [Symbol.dispose](): void {
    this.release();
    fs.open = this.open;
    syncBuiltinESMExports();
  }
}
