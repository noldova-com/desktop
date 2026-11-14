/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ProcessListFixture } from "./process-list.fixture.ts";

export class ProcessStartTimes {
  private readonly queried: readonly number[];
  private readonly listing: ReadonlyMap<number, number>;

  public readonly own: number;

  public constructor(queried: readonly number[], listing: ReadonlyMap<number, number>) {
    const own = listing.get(process.pid);
    if (Object.isUndefined(own))
      throw new Error(`The process list gave no start time for this process, ${process.pid}, so the list failed, and no run can be told to have ended.`);
    this.queried = queried;
    this.listing = listing;
    this.own = own;
  }

  public static async readAsync(processIds: readonly number[]): Promise<ProcessStartTimes> {
    const queried = [...new Set([process.pid, ...processIds])];
    return new ProcessStartTimes(queried, await ProcessListFixture.readStartTimesAsync(queried));
  }

  public hasEnded(processId: number, started: number): boolean {
    return this.queried.includes(processId) && this.listing.get(processId) !== started;
  }
}
