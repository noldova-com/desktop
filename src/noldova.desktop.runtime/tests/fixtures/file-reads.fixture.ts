/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";

export class FileReadsFixture implements Disposable {
  private readonly restore: () => void;
  private readonly waiting: Map<number, () => void> = new Map();
  private reads: number = 0;

  public constructor(file: string) {
    const readFile = fs.readFile;
    const reading = mock.method(fs, "readFile", (...values: Parameters<typeof fs.readFile>): Promise<string | Buffer> => {
      const [target] = values;
      if (String(target) === file)
        this.count();
      return readFile(...values);
    });
    this.restore = () => reading.mock.restore();
    syncBuiltinESMExports();
  }

  public waitForMoreAsync(count: number): Promise<void> {
    const target = this.reads + count;
    const reached = Promise.withResolvers<void>();
    this.waiting.set(target, reached.resolve);
    return reached.promise;
  }

  public [Symbol.dispose](): void {
    this.restore();
    syncBuiltinESMExports();
  }

  private count(): void {
    this.reads++;
    this.waiting.get(this.reads)?.();
    this.waiting.delete(this.reads);
  }
}
