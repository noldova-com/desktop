/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mock } from "node:test";

export class PausedTimersFixture {
  public static async withoutPausesAsync<T>(run: () => Promise<T>, pause: number): Promise<T> {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const running = run();
      let isDone = false;
      void running.then(() => {
        isDone = true;
      }, () => {
        isDone = true;
      });
      while (!isDone) {
        await new Promise<void>(resolve => setImmediate(resolve));
        mock.timers.tick(pause);
      }
      return await running;
    }
    finally {
      mock.timers.reset();
    }
  }
}
