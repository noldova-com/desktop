/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

export class FileReadsFixture implements Disposable {
  private readonly readFile: typeof fs.readFile = fs.readFile;
  private readonly waiting: Map<number, () => void> = new Map();
  private reads: number = 0;

  public constructor(file: string) {
    const readFile = this.readFile;
    fs.readFile = ((...values: Parameters<typeof fs.readFile>): Promise<string | Buffer> => {
      const [target] = values;
      if (String(target) === file)
        this.count();
      return readFile(...values);
    }) as typeof fs.readFile;
    syncBuiltinESMExports();
  }

  public waitForMoreAsync(count: number): Promise<void> {
    const target = this.reads + count;
    const reached = Promise.withResolvers<void>();
    this.waiting.set(target, reached.resolve);
    return reached.promise;
  }

  public [Symbol.dispose](): void {
    fs.readFile = this.readFile;
    syncBuiltinESMExports();
  }

  private count(): void {
    this.reads++;
    this.waiting.get(this.reads)?.();
    this.waiting.delete(this.reads);
  }
}
