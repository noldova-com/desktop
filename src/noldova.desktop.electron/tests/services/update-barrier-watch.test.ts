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
import { FakeUpdateHost } from "../fixtures/fake-update-host.fixture.js";
import { FolderWatchFixture } from "../fixtures/folder-watch.fixture.js";

@TestClass
export class UpdateBarrierWatchTests {
  private readonly updates: FakeUpdateHost = new FakeUpdateHost();
  private readonly logged: string[] = [];
  private isConnected: boolean = false;
  private changes: number = 0;

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
      const state = { isSettled: false };
      const quitting = Condition.waitAsync(() => this.updates.quitCount > 0).finally(() => {
        state.isSettled = true;
      });
      while (!state.isSettled)
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

  private change(): void {
    this.changes += 1;
  }

  private create(folder: string): UpdateBarrierWatch {
    return new UpdateBarrierWatch(this.updates, folder, () => this.isConnected, () => this.change(), t => this.logged.push(t));
  }
}
