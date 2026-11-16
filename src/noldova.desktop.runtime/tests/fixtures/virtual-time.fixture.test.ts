/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout } from "node:timers/promises";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { VirtualTimeFixture } from "./virtual-time.fixture.js";

@TestClass
export class VirtualTimeFixtureTests {
  @TestMethod
  public async movesToTheLongestOfWaitsThatOverlap(): Promise<void> {
    const took = await VirtualTimeFixture.measureAsync(async () => {
      await Promise.all([setTimeout(600), setTimeout(600), setTimeout(300)]);
    });

    Assert.areEqual(600, took);
  }

  @TestMethod
  public async addsWaitsThatFollowEachOther(): Promise<void> {
    const took = await VirtualTimeFixture.measureAsync(async () => {
      await setTimeout(300);
      await setTimeout(600);
    });

    Assert.areEqual(900, took);
  }

  @TestMethod
  public async endsTheEarliestWaitFirst(): Promise<void> {
    using time = new VirtualTimeFixture();
    const ended: string[] = [];

    await Promise.all([
      setTimeout(600).then(() => ended.push(`late ${time.elapsed}`)),
      setTimeout(300).then(() => ended.push(`early ${time.elapsed}`))
    ]);

    Assert.areEqual("early 300,late 600", ended.join(","));
  }

  @TestMethod
  public async leavesTheClockWhereItIsForAnAbortedWait(): Promise<void> {
    using time = new VirtualTimeFixture();
    const timeout = new AbortController();
    const wait = setTimeout(600, undefined, { signal: timeout.signal });

    timeout.abort();
    const failure = await Assert.throwsAsync(() => wait, Error);
    await setTimeout(50);

    Assert.areEqual("AbortError", failure.name);
    Assert.areEqual(50, time.elapsed);
  }

  @TestMethod
  public async refusesAWaitWhoseSignalIsAlreadyAborted(): Promise<void> {
    using time = new VirtualTimeFixture();

    const failure = await Assert.throwsAsync(() => setTimeout(600, undefined, { signal: AbortSignal.abort() }), Error);

    Assert.areEqual("AbortError", failure.name);
    Assert.areEqual(0, time.elapsed);
  }

  @TestMethod
  public async endsAWaitStillPendingWhenItIsDisposed(): Promise<void> {
    const time = new VirtualTimeFixture();
    const wait = setTimeout(600, "ended");

    time[Symbol.dispose]();

    Assert.areEqual("ended", await wait);
    Assert.areEqual(0, time.elapsed);
  }
}
