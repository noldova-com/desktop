/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { syncBuiltinESMExports } from "node:module";
import timers from "node:timers/promises";

import "@noldova/context.core";

export class VirtualTimeFixture implements Disposable {
  private readonly setTimeout: typeof timers.setTimeout = timers.setTimeout;
  private readonly now: typeof Date.now = Date.now;
  private readonly start: number;
  private time: number;

  public constructor() {
    const setTimeout = this.setTimeout;
    this.start = this.now();
    this.time = this.start;
    timers.setTimeout = (<T = void>(milliseconds?: number, value?: T): Promise<T> => {
      this.time += milliseconds ?? 0;
      return setTimeout(0, value);
    }) as typeof timers.setTimeout;
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
    timers.setTimeout = this.setTimeout;
    Date.now = this.now;
    syncBuiltinESMExports();
  }
}
