/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { syncBuiltinESMExports } from "node:module";
import { mock } from "node:test";
import timers from "node:timers/promises";

import "@noldova/context.core";

interface IVirtualWait {
  readonly deadline: number;
  readonly resolve: () => void;
}

export class VirtualTimeFixture implements Disposable {
  private readonly setTimeout: typeof timers.setTimeout = timers.setTimeout;
  private readonly restoreSetTimeout: () => void;
  private readonly now: typeof Date.now = Date.now;
  private readonly waits: IVirtualWait[] = [];
  private readonly start: number;
  private time: number;
  private isAdvancing: boolean = false;
  private isDisposed: boolean = false;

  public constructor() {
    this.start = this.now();
    this.time = this.start;
    const waiting = mock.method(timers, "setTimeout", <T = void>(milliseconds?: number, value?: T, options?: { signal?: AbortSignal }): Promise<T | undefined> =>
      this.waitAsync(milliseconds ?? 0, value, options?.signal));
    this.restoreSetTimeout = () => waiting.mock.restore();
    Date.now = (): number => this.time;
    syncBuiltinESMExports();
  }

  public get elapsed(): number {
    return this.time - this.start;
  }

  public static async measureAsync(action: () => Promise<void>): Promise<number> {
    using time = new VirtualTimeFixture();
    await action();
    return time.elapsed;
  }

  public [Symbol.dispose](): void {
    this.isDisposed = true;
    this.restoreSetTimeout();
    Date.now = this.now;
    syncBuiltinESMExports();
    for (const wait of this.waits.splice(0))
      wait.resolve();
  }

  private waitAsync<T>(milliseconds: number, value: T | undefined, signal: AbortSignal | undefined): Promise<T | undefined> {
    const { promise, resolve, reject } = Promise.withResolvers<T | undefined>();
    const abort = (): void => {
      this.waits.splice(this.waits.indexOf(wait), 1);
      reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError", code: "ABORT_ERR", cause: signal?.reason }));
    };
    const wait: IVirtualWait = {
      deadline: this.time + milliseconds,
      resolve: (): void => {
        signal?.removeEventListener("abort", abort);
        resolve(value);
      }
    };
    this.waits.push(wait);
    if (signal?.aborted === true)
      abort();
    else {
      signal?.addEventListener("abort", abort, { once: true });
      this.advance();
    }
    return promise;
  }

  private advance(): void {
    if (this.isAdvancing)
      return;
    this.isAdvancing = true;
    void this.setTimeout(0).then(() => {
      this.isAdvancing = false;
      if (this.isDisposed || this.waits.length === 0)
        return;
      const next = this.waits.reduce((earliest, t) => t.deadline < earliest.deadline ? t : earliest);
      this.waits.splice(this.waits.indexOf(next), 1);
      this.time = Math.max(this.time, next.deadline);
      next.resolve();
      this.advance();
    });
  }
}
