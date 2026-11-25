/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import { WaitTimedOutException } from "../exceptions/wait-timed-out.exception.ts";

export class WaitFixture {
  private static readonly INTERVAL: number = 25;

  public static async untilAsync(condition: () => boolean | Promise<boolean>, description: string, limitMilliseconds: number, intervalMilliseconds: number = WaitFixture.INTERVAL): Promise<void> {
    const holds = await WaitFixture.holdsWithinAsync(condition, limitMilliseconds, intervalMilliseconds);
    if (!holds)
      throw new WaitTimedOutException(description, limitMilliseconds);
  }

  public static async holdsWithinAsync(condition: () => boolean | Promise<boolean>, limitMilliseconds: number, intervalMilliseconds: number = WaitFixture.INTERVAL): Promise<boolean> {
    const deadline = performance.now() + limitMilliseconds;
    while (!await condition()) {
      if (performance.now() >= deadline)
        return false;
      await delay(intervalMilliseconds);
    }
    return true;
  }
}
