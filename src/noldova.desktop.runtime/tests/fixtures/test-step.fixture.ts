/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Channel, channel } from "node:diagnostics_channel";

import "@noldova/context.core";

export class TestStepFixture {
  public static readonly STARTED_CHANNEL: string = "noldova.test-run.step-started";
  public static readonly ENDED_CHANNEL: string = "noldova.test-run.step-ended";

  private readonly started: Channel = channel(TestStepFixture.STARTED_CHANNEL);
  private readonly ended: Channel = channel(TestStepFixture.ENDED_CHANNEL);

  public async runAsync<T>(step: string, action: () => Promise<T>): Promise<T> {
    this.started.publish(step);
    try {
      return await action();
    }
    finally {
      this.ended.publish(step);
    }
  }
}
