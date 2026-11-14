/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WaitFixture } from "./wait.fixture.js";

export class Condition {
  private static readonly LIMIT: number = 10_000;
  private static readonly INTERVAL: number = 5;

  public static async waitAsync(condition: () => boolean | Promise<boolean>): Promise<void> {
    await WaitFixture.untilAsync(condition, "the condition to hold", Condition.LIMIT, Condition.INTERVAL);
  }
}
