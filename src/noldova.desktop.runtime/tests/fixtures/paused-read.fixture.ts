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
  private readonly started: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private readonly paused: PromiseWithResolvers<string | Buffer> = Promise.withResolvers<string | Buffer>();
  private isStarted: boolean = false;

  public constructor(file: string) {
    const readFile = this.readFile;
    fs.readFile = ((...values: Parameters<typeof fs.readFile>): Promise<string | Buffer> => {
      const [target] = values;
      if (String(target) !== file || this.isStarted)
        return readFile(...values);
      this.isStarted = true;
      this.started.resolve();
      return this.paused.promise;
    }) as typeof fs.readFile;
    syncBuiltinESMExports();
  }

  public async waitForStartAsync(): Promise<void> {
    await this.started.promise;
  }

  public releaseAsMissing(): void {
    this.paused.reject(Object.assign(new Error("ENOENT: no such file or directory"), { code: "ENOENT" }));
  }

  public [Symbol.dispose](): void {
    fs.readFile = this.readFile;
    syncBuiltinESMExports();
  }
}
