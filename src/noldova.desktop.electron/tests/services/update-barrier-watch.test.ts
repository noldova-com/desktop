/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateProcess } from "@noldova/desktop.protocol";
import { RuntimeBuild, UpdateBarrier, UpdateBarrierState } from "@noldova/desktop.runtime";
import { UpdateBarrierWatch } from "@noldova/desktop.electron";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeClock } from "../fixtures/fake-clock.fixture.js";
import { FakeUpdateHost } from "../fixtures/fake-update-host.fixture.js";
import { FolderWatchFixture } from "../fixtures/folder-watch.fixture.js";

@TestClass
export class UpdateBarrierWatchTests {
  private readonly updates: FakeUpdateHost = new FakeUpdateHost();
  private readonly clock: FakeClock = new FakeClock();
  private readonly logged: string[] = [];
  private isConnected: boolean = false;
  private changes: number = 0;
  private connectionChecks: number = 0;

  @TestMethod
  public async quitsAMainProcessWithoutAConnectionOnceAnotherMainProcessesUpdateIsClosing(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    this.updates.barriers.push(
      new Error("The barrier is being replaced."),
      null,
      FakeUpdateHost.barrier(UpdateBarrierState.Preparing),
      FakeUpdateHost.barrier(UpdateBarrierState.Closing, new UpdateProcess(4121, 1500, 1501, "main")),
      FakeUpdateHost.barrier(UpdateBarrierState.Closing),
      FakeUpdateHost.barrier(UpdateBarrierState.Closing),
      FakeUpdateHost.barrier(UpdateBarrierState.Closing));
    this.updates.ended.push(true, new Error("ps exited with code 1."), false);

    const results = [];
    for (let check = 0; check < 7; check++)
      results.push(await watch.checkAsync());

    Assert.areEqual("false false false false false false true", results.join(" "));
    Assert.areEqual(1, this.updates.quitCount);
  }

  @TestMethod
  public async checksAgainByItselfAfterABarrierItCannotReadOrAnUpdateItCannotTellHasEndedAndQuitsOnceItCan(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    this.updates.barriers.push(UpdateBarrierWatchTests.failure("EPERM", "operation not permitted, open 'barrier.json'"), FakeUpdateHost.barrier(UpdateBarrierState.Closing), FakeUpdateHost.barrier(UpdateBarrierState.Closing));
    this.updates.ended.push(UpdateBarrierWatchTests.failure("EAGAIN", "resource temporarily unavailable, spawn"), false);

    const isQuit = await watch.checkAsync();
    this.clock.advance(100);
    await Condition.waitAsync(() => this.logged.length === 2);
    this.clock.advance(200);
    await Condition.waitAsync(() => this.updates.quitCount > 0);

    Assert.isFalse(isQuit);
    Assert.areEqual(0, this.updates.barriers.length);
    Assert.areEqual(1, this.updates.quitCount);
    Assert.areEqual("100,200", this.clock.waits.join(","));
    Assert.areEqual(JSON.stringify([
      "The launch barrier could not be checked after the runtime was lost, so it is checked again in 100 ms: Error: EPERM: operation not permitted, open 'barrier.json'",
      "The launch barrier could not be checked after the runtime was lost, so it is checked again in 200 ms: Error: EAGAIN: resource temporarily unavailable, spawn"
    ]), JSON.stringify(this.logged));
  }

  @TestMethod
  public async checksNothingAgainAfterAFailedCheckOnceTheMainProcessIsConnectedAgain(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    this.updates.barriers.push(UpdateBarrierWatchTests.failure("EPERM", "operation not permitted, open 'barrier.json'"));

    await watch.checkAsync();
    this.isConnected = true;
    this.updates.barriers.push(FakeUpdateHost.barrier(UpdateBarrierState.Closing));
    this.clock.advance(100);
    await Condition.waitAsync(() => this.connectionChecks === 2);

    Assert.areEqual(0, this.updates.quitCount);
    Assert.areEqual(1, this.updates.barriers.length);
    Assert.areEqual(1, this.logged.length);
  }

  @TestMethod
  public async cancelsTheCheckWaitingToRunAgainWhenStopped(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    this.updates.barriers.push(UpdateBarrierWatchTests.failure("EPERM", "operation not permitted, open 'barrier.json'"), FakeUpdateHost.barrier(UpdateBarrierState.Closing));
    await watch.checkAsync();
    const scheduled = this.clock.pending;

    watch.stop();
    this.clock.advance(100);

    Assert.areEqual(1, scheduled);
    Assert.areEqual(0, this.clock.pending);
    Assert.areEqual(1, this.connectionChecks);
    Assert.areEqual(1, this.updates.barriers.length);
    Assert.areEqual(0, this.updates.quitCount);
  }

  @TestMethod
  public async checksNothingAgainForACheckThatFailsAfterTheWatchStopped(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    const read = Promise.withResolvers<UpdateBarrier | null>();
    this.updates.reading = read.promise;
    const checking = watch.checkAsync();

    watch.stop();
    read.reject(UpdateBarrierWatchTests.failure("EPERM", "operation not permitted, open 'barrier.json'"));

    Assert.isFalse(await checking);
    Assert.areEqual(0, this.clock.waits.length);
    Assert.areEqual(0, this.logged.length);
    Assert.areEqual(0, this.updates.quitCount);
  }

  @TestMethod
  public async leavesTheMainProcessRunningForACheckThatFindsTheUpdateClosingAfterTheWatchStopped(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    const read = Promise.withResolvers<UpdateBarrier | null>();
    this.updates.reading = read.promise;
    const checking = watch.checkAsync();
    watch.stop();
    read.resolve(FakeUpdateHost.barrier(UpdateBarrierState.Closing));

    Assert.isFalse(await checking);
    Assert.areEqual(0, this.updates.quitCount);
  }

  @TestMethod
  public async checksAgainByItselfFourTimesAtMostWithAGrowingDelayCountingOnlyItsOwnChecks(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    for (let failure = 0; failure < 7; failure++)
      this.updates.barriers.push(UpdateBarrierWatchTests.failure("EPERM", "operation not permitted, open 'barrier.json'"));

    await watch.checkAsync();
    await watch.checkAsync();
    for (const delay of [100, 200, 400, 800]) {
      const count = this.logged.length;
      this.clock.advance(delay);
      await Condition.waitAsync(() => this.logged.length > count);
    }
    await watch.checkAsync();

    Assert.areEqual(0, this.updates.barriers.length);
    Assert.areEqual(0, this.updates.quitCount);
    Assert.areEqual(0, this.clock.pending);
    Assert.areEqual("100,200,400,800", this.clock.waits.join(","));
    Assert.areEqual(JSON.stringify([
      "The launch barrier could not be checked after the runtime was lost, so it is checked again in 100 ms: Error: EPERM: operation not permitted, open 'barrier.json'",
      "The launch barrier could not be checked after the runtime was lost, and it is checked again as already planned: Error: EPERM: operation not permitted, open 'barrier.json'",
      "The launch barrier could not be checked after the runtime was lost, so it is checked again in 200 ms: Error: EPERM: operation not permitted, open 'barrier.json'",
      "The launch barrier could not be checked after the runtime was lost, so it is checked again in 400 ms: Error: EPERM: operation not permitted, open 'barrier.json'",
      "The launch barrier could not be checked after the runtime was lost, so it is checked again in 800 ms: Error: EPERM: operation not permitted, open 'barrier.json'",
      "The launch barrier still could not be checked after the runtime was lost when checked again, so it is not tried again: Error: EPERM: operation not permitted, open 'barrier.json'",
      "The launch barrier could not be checked after the runtime was lost, so it is not tried again: Error: EPERM: operation not permitted, open 'barrier.json'"
    ]), JSON.stringify(this.logged));
  }

  @TestMethod
  public async stopsCheckingAgainByItselfOnceFiveSecondsHavePassedSinceTheFirstFailure(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    for (let failure = 0; failure < 3; failure++)
      this.updates.barriers.push(UpdateBarrierWatchTests.failure("EPERM", "operation not permitted, open 'barrier.json'"));

    await watch.checkAsync();
    this.clock.advance(5000);
    await Condition.waitAsync(() => this.logged.length === 2);
    await watch.checkAsync();

    Assert.areEqual(0, this.updates.barriers.length);
    Assert.areEqual(0, this.clock.pending);
    Assert.areEqual("100", this.clock.waits.join(","));
    Assert.areEqual(JSON.stringify([
      "The launch barrier could not be checked after the runtime was lost, so it is checked again in 100 ms: Error: EPERM: operation not permitted, open 'barrier.json'",
      "The launch barrier still could not be checked after the runtime was lost when checked again, so it is not tried again: Error: EPERM: operation not permitted, open 'barrier.json'",
      "The launch barrier could not be checked after the runtime was lost, so it is not tried again: Error: EPERM: operation not permitted, open 'barrier.json'"
    ]), JSON.stringify(this.logged));
  }

  @TestMethod
  public async checksNothingAgainByItselfAfterAFailureThatDoesNotPass(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    this.updates.barriers.push(new Error("The barrier is not JSON."), FakeUpdateHost.barrier(UpdateBarrierState.Closing));

    await watch.checkAsync();

    Assert.areEqual(0, this.clock.waits.length);
    Assert.areEqual(1, this.updates.barriers.length);
    Assert.areEqual(0, this.updates.quitCount);
    Assert.areEqual(JSON.stringify(["The launch barrier could not be checked after the runtime was lost, so it is not tried again: Error: The barrier is not JSON."]),
      JSON.stringify(this.logged));
  }

  @TestMethod
  public async quitsAMainProcessWithoutAConnectionOnceAnotherMainProcessHandedOffAnotherVersion(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    const handedOff = FakeUpdateHost.barrier(UpdateBarrierState.HandedOff);
    Assert.areNotEqual(RuntimeBuild.identity.productVersion, handedOff.version);
    this.updates.barriers.push(
      new UpdateBarrier(FakeUpdateHost.COORDINATOR, RuntimeBuild.identity.productVersion, UpdateBarrierState.HandedOff, null),
      FakeUpdateHost.barrier(UpdateBarrierState.HandedOff, new UpdateProcess(4121, 1500, 1501, "main")),
      handedOff);
    this.updates.ended.push(false);

    const results = [];
    for (let check = 0; check < 3; check++)
      results.push(await watch.checkAsync());

    Assert.areEqual("false false true", results.join(" "));
    Assert.areEqual(1, this.updates.quitCount);
  }

  @TestMethod
  public async leavesAConnectedMainProcessToItsRuntimeAndChecksAgainForACheckAskedDuringOne(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    let read: (barrier: null) => void = () => undefined;
    this.updates.reading = new Promise(resolve => {
      read = resolve;
    });
    this.isConnected = true;
    const connected = await watch.checkAsync();
    this.isConnected = false;

    const first = watch.checkAsync();
    const second = await watch.checkAsync();
    read(null);
    const isFirstQuit = await first;
    this.updates.reading = null;
    this.updates.barriers.push(FakeUpdateHost.barrier(UpdateBarrierState.Closing));
    const third = await watch.checkAsync();

    Assert.isFalse(connected);
    Assert.isFalse(second);
    Assert.isFalse(isFirstQuit);
    Assert.isTrue(third);
    Assert.areEqual(1, this.updates.quitCount);
  }

  @TestMethod
  public async quitsForACheckAskedWithoutAConnectionDuringAnotherOneEvenWhenTheRuntimeIsBackBeforeItRuns(): Promise<void> {
    const watch = this.create(join(tmpdir(), "nol-barrier-watch-unused"));
    let read: (barrier: null) => void = () => undefined;
    this.updates.reading = new Promise(resolve => {
      read = resolve;
    });
    const first = watch.checkAsync();
    this.isConnected = true;
    const whileConnected = await watch.checkAsync();
    this.isConnected = false;
    const lost = await watch.checkAsync();
    this.isConnected = true;
    this.updates.reading = null;
    this.updates.barriers.push(FakeUpdateHost.barrier(UpdateBarrierState.Closing));
    read(null);

    Assert.isTrue(await first);
    Assert.isFalse(whileConnected);
    Assert.isFalse(lost);
    Assert.areEqual(1, this.updates.quitCount);
  }

  @TestMethod
  public async checksOnceStartedAndReportsAndChecksEachChangeInTheFolderUntilItQuits(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "nol-barrier-watch-"));
    try {
      using watches = new FolderWatchFixture(folder);
      const watch = this.create(folder);
      this.updates.barriers.push(FakeUpdateHost.barrier(UpdateBarrierState.Preparing));

      watch.start();
      watch.start();
      await Condition.waitAsync(() => this.updates.barriers.length === 0);
      this.updates.barriers.push(FakeUpdateHost.barrier(UpdateBarrierState.Closing));
      let isSettled = false;
      const quitting = Condition.waitAsync(() => this.updates.quitCount > 0).finally(() => {
        isSettled = true;
      });
      while (!isSettled)
        await writeFile(join(folder, "barrier.json"), "{}");
      await quitting;
      await Condition.waitAsync(() => watches.closed === 1);

      Assert.isTrue(this.changes > 0);
      Assert.areEqual(1, watches.count);
      Assert.areEqual(1, this.updates.quitCount);
      Assert.areEqual(0, this.logged.length);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async closesTheWatchWhenStopped(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "nol-barrier-watch-"));
    try {
      using watches = new FolderWatchFixture(folder);
      const watch = this.create(folder);

      watch.start();
      watch.stop();
      watch.stop();
      await Condition.waitAsync(() => watches.closed === 1);

      Assert.areEqual(1, watches.count);
      Assert.areEqual(0, this.updates.quitCount);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async logsAFolderItCannotWatchAndChecksNothing(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "nol-barrier-watch-"));
    const missing = join(folder, "missing");
    try {
      const watch = this.create(missing);
      this.updates.barriers.push(FakeUpdateHost.barrier(UpdateBarrierState.Closing));

      watch.start();

      Assert.areEqual(1, this.logged.length);
      Assert.isTrue(this.logged[0]?.startsWith("The launch barrier's folder could not be watched, so another main process's update can't close this one: Error: ENOENT") === true,
        this.logged.join("\n"));
      Assert.areEqual(1, this.updates.barriers.length);
      Assert.areEqual(0, this.updates.quitCount);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async logsAndClosesAWatchThatFails(): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "nol-barrier-watch-"));
    try {
      using watches = new FolderWatchFixture(folder);
      const watch = this.create(folder);
      this.updates.barriers.push(FakeUpdateHost.barrier(UpdateBarrierState.Preparing));

      watch.start();
      await Condition.waitAsync(() => this.updates.barriers.length === 0);
      watches.fail("The watch broke.");
      await Condition.waitAsync(() => watches.closed === 1);

      Assert.areEqual(JSON.stringify(["The launch barrier's folder could not be watched, so another main process's update can't close this one: Error: The watch broke."]),
        JSON.stringify(this.logged));
      Assert.areEqual(0, this.updates.quitCount);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private connected(): boolean {
    this.connectionChecks += 1;
    return this.isConnected;
  }

  private change(): void {
    this.changes += 1;
  }

  private create(folder: string): UpdateBarrierWatch {
    return new UpdateBarrierWatch(this.updates, folder, () => this.connected(), () => this.change(), t => this.logged.push(t), () => this.clock.now(),
      (wait, run) => this.schedule(wait, run));
  }

  private schedule(wait: number, run: () => void): () => void {
    const cancel = new AbortController();
    void this.clock.waitAsync(wait, cancel.signal).then(run, () => undefined);
    return () => cancel.abort();
  }

  private static failure(code: string, message: string): NodeJS.ErrnoException {
    const error: NodeJS.ErrnoException = new Error(`${code}: ${message}`);
    error.code = code;
    return error;
  }
}
