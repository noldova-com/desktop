/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";

import "@noldova/context.core";

export class PausedReadFixture implements Disposable {
  private readonly readFile: typeof fs.readFile = fs.readFile;
  private readonly started: PromiseWithResolvers<() => Promise<string | Buffer>> = Promise.withResolvers<() => Promise<string | Buffer>>();
  private readonly paused: PromiseWithResolvers<string | Buffer> = Promise.withResolvers<string | Buffer>();
  private isStarted: boolean = false;

  public constructor(file: string) {
    const readFile = this.readFile;
    fs.readFile = ((...values: Parameters<typeof fs.readFile>): Promise<string | Buffer> => {
      const [target] = values;
      if (String(target) !== file || this.isStarted)
        return readFile(...values);
      this.isStarted = true;
      this.started.resolve(() => readFile(...values));
      return this.paused.promise;
    }) as typeof fs.readFile;
    syncBuiltinESMExports();
  }

  public async waitForStartAsync(): Promise<void> {
    await this.started.promise;
  }

  public async releaseAsync(): Promise<void> {
    const read = await this.started.promise;
    await read().then(this.paused.resolve, this.paused.reject);
  }

  public [Symbol.dispose](): void {
    fs.readFile = this.readFile;
    syncBuiltinESMExports();
  }
}
