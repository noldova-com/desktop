/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

export class WaitFixture {
  private static readonly INTERVAL: number = 25;

  public static async untilAsync(condition: () => boolean | Promise<boolean>, limitMilliseconds: number, intervalMilliseconds: number = WaitFixture.INTERVAL): Promise<boolean> {
    const deadline = performance.now() + limitMilliseconds;
    while (!await condition()) {
      if (performance.now() >= deadline)
        return false;
      await delay(intervalMilliseconds);
    }
    return true;
  }

  public static async isPendingAsync(promise: Promise<unknown>): Promise<boolean> {
    const pending = Symbol("pending");
    return await Promise.race([promise, Promise.resolve(pending)]) === pending;
  }
}
