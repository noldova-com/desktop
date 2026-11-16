/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { Worker } from "node:worker_threads";

import "@noldova/context.core";

export class SlowAppendFixture implements Disposable {
  private static readonly WRITER: string = [
    "const { appendFileSync } = require('node:fs');",
    "const { workerData } = require('node:worker_threads');",
    "appendFileSync(workerData.file, workerData.text);"
  ].join("\n");

  private readonly appendFile: typeof fs.appendFile = fs.appendFile;
  private readonly held: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public calls: number = 0;

  public constructor(isHeld: boolean) {
    const appendFile = this.appendFile;
    fs.appendFile = ((...values: Parameters<typeof fs.appendFile>): Promise<void> => {
      if (this.calls++ > 0)
        return appendFile(...values);
      const [file, text] = values;
      return isHeld
        ? this.held.promise.then(() => appendFile(...values))
        : SlowAppendFixture.writeOnWorkerAsync(String(file), String(text));
    }) as typeof fs.appendFile;
    syncBuiltinESMExports();
  }

  public release(): void {
    this.held.resolve();
  }

  public [Symbol.dispose](): void {
    fs.appendFile = this.appendFile;
    syncBuiltinESMExports();
  }

  private static writeOnWorkerAsync(file: string, text: string): Promise<void> {
    const written = Promise.withResolvers<void>();
    const worker = new Worker(SlowAppendFixture.WRITER, { eval: true, workerData: { file, text } });
    worker.once("error", written.reject);
    worker.once("exit", () => written.resolve());
    return written.promise;
  }
}
