/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { Worker } from "node:worker_threads";

import "@noldova/context.core";

type WriteCallback = (failure: NodeJS.ErrnoException | null, written?: number) => void;

export class SlowWriteFixture implements Disposable {
  private static readonly WRITER: string = [
    "const { writeSync } = require('node:fs');",
    "const { workerData } = require('node:worker_threads');",
    "writeSync(workerData.handle, workerData.text);"
  ].join("\n");

  private readonly write: typeof fs.write = fs.write;
  private readonly held: PromiseWithResolvers<NodeJS.ErrnoException | null> = Promise.withResolvers<NodeJS.ErrnoException | null>();
  private readonly called: Map<number, PromiseWithResolvers<void>> = new Map<number, PromiseWithResolvers<void>>();

  public calls: number = 0;

  public constructor(isHeld: boolean) {
    const write = this.write;
    fs.write = ((handle: number, text: Buffer, callback: WriteCallback): void => {
      this.calls++;
      this.callFor(this.calls).resolve();
      if (this.calls > 1) {
        write(handle, text, callback);
        return;
      }
      if (!isHeld) {
        SlowWriteFixture.writeOnWorker(handle, text, callback);
        return;
      }
      void this.held.promise.then(failure => {
        if (Object.isNull(failure))
          write(handle, text, callback);
        else
          callback(failure);
      });
    }) as typeof fs.write;
    syncBuiltinESMExports();
  }

  public calledAsync(count: number): Promise<void> {
    return this.callFor(count).promise;
  }

  public release(): void {
    this.held.resolve(null);
  }

  public fail(failure: NodeJS.ErrnoException): void {
    this.held.resolve(failure);
  }

  public [Symbol.dispose](): void {
    fs.write = this.write;
    syncBuiltinESMExports();
  }

  private callFor(count: number): PromiseWithResolvers<void> {
    const call = this.called.get(count) ?? Promise.withResolvers<void>();
    this.called.set(count, call);
    return call;
  }

  private static writeOnWorker(handle: number, text: Buffer, callback: WriteCallback): void {
    const worker = new Worker(SlowWriteFixture.WRITER, { eval: true, workerData: { handle, text } });
    worker.once("error", callback);
    worker.once("exit", () => callback(null, text.length));
  }
}
