/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { FolderWatch } from "../../../src/services/files/folder-watch.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";
import { WatchPatchFixture } from "../../fixtures/watch-patch.fixture.js";

@TestClass
export class FolderWatchTests {
  private static readonly LIMIT: number = 30_000;
  private static readonly TICKS: number = 5;
  private static readonly LOG: (text: string) => void = () => undefined;

  @TestMethod
  public async wakesWhenAFileChangesInTheFolder(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using watch = FolderWatch.open(folder.path, FolderWatchTests.LOG);

    const isWoken = await FolderWatchTests.changeUntilWokenAsync(watch, () => writeFile(path.join(folder.path, "runtime.json"), "{}"));

    Assert.isTrue(isWoken, "the change ends the wait, not its timeout");
  }

  @TestMethod
  public async followsTheFolderOnceItAndItsParentsAreCreated(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using watches = new WatchPatchFixture();
    const target = path.join(folder.path, "data", "discovery");
    using watch = FolderWatch.open(target, FolderWatchTests.LOG);
    const woken: boolean[] = [];

    await mkdir(target, { recursive: true });
    while (watches.folders.at(-1) !== target && !woken.includes(false))
      woken.push(await FolderWatchTests.changeUntilWokenAsync(watch, () => writeFile(path.join(folder.path, "other.txt"), "other")));
    woken.push(await FolderWatchTests.changeUntilWokenAsync(watch, () => writeFile(path.join(target, "runtime.json"), "{}")));

    Assert.areEqual(folder.path, watches.folders[0]);
    Assert.areEqual(target, watches.folders.at(-1));
    Assert.isFalse(woken.includes(false), "the changes end the waits, not their timeout");
  }

  @TestMethod
  public async keepsWatchingTheNearestFolderWhileTheFolderIsMissing(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using watches = new WatchPatchFixture();
    using watch = FolderWatch.open(path.join(folder.path, "missing"), FolderWatchTests.LOG);

    await FolderWatchTests.changeUntilWokenAsync(watch, () => writeFile(path.join(folder.path, "other.txt"), "other"));

    Assert.areEqual(folder.path, watches.folders.join(","));
  }

  @TestMethod
  public async keepsAChangeThatCameBeforeTheWaitForTheNextWaitOnly(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using watches = WatchPatchFixture.quiet();
    using watch = FolderWatch.open(folder.path, FolderWatchTests.LOG);

    watches.change();
    await watch.waitAsync(FolderWatchTests.LIMIT, () => false);
    const next = watch.waitAsync(FolderWatchTests.LIMIT, () => false);

    Assert.isTrue(await WaitFixture.isPendingAsync(next), "the change wakes one wait");
    watches.change();
    await next;
  }

  @TestMethod
  public async wakesAtTheNextTickForAChangeInTheFolderItsWatchMissedAndOnlyOnce(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using _watches = WatchPatchFixture.quiet();
    using watch = FolderWatch.open(folder.path, FolderWatchTests.LOG, 1);
    let ticks = 0;

    await writeFile(path.join(folder.path, "runtime.json"), "{}");
    const isWoken = await watch.waitAsync(FolderWatchTests.LIMIT, () => false);
    await watch.waitAsync(FolderWatchTests.LIMIT, () => ++ticks === FolderWatchTests.TICKS);

    Assert.isTrue(isWoken, "a check tick finds the change the watch never reported, not the wait's timeout");
    Assert.areEqual(FolderWatchTests.TICKS, ticks, "the change seen at one wake doesn't wake the next wait");
  }

  @TestMethod
  public async wakesAtTheNextTickOnceTheMissingFolderIsCreatedThoughItsWatchMissedIt(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using _watches = WatchPatchFixture.quiet();
    const target = path.join(folder.path, "discovery");
    using watch = FolderWatch.open(target, FolderWatchTests.LOG, 1);

    await mkdir(target);

    Assert.isTrue(await watch.waitAsync(FolderWatchTests.LIMIT, () => false), "a check tick finds the new folder, not the wait's timeout");
  }

  @TestMethod
  public async endsTheWaitAtItsTimeout(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using _watches = WatchPatchFixture.quiet();
    using watch = FolderWatch.open(folder.path, FolderWatchTests.LOG);

    Assert.isFalse(await watch.waitAsync(-1, () => false));
  }

  @TestMethod
  public async endsTheWaitOnceItsCheckHolds(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using watch = FolderWatch.open(folder.path, FolderWatchTests.LOG, 1);

    Assert.isTrue(await watch.waitAsync(FolderWatchTests.LIMIT, () => true), "the check ends the wait, not its timeout");
  }

  @TestMethod
  public async failsTheWaitWithItsChecksFailure(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using _watches = WatchPatchFixture.quiet();
    using watch = FolderWatch.open(folder.path, FolderWatchTests.LOG, 1);

    const error = await Assert.throwsAsync(() => watch.waitAsync(FolderWatchTests.LIMIT, () => {
      throw new Error("EPERM: operation not permitted, kill");
    }), Error);

    Assert.areEqual("EPERM: operation not permitted, kill", error.message);
  }

  @TestMethod
  public async movesDownToTheFolderCreatedWhileItsParentsWatchStarts(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using watches = new WatchPatchFixture();
    const target = path.join(folder.path, "discovery");
    watches.onWatch = () => mkdirSync(target, { recursive: true });
    using watch = FolderWatch.open(target, FolderWatchTests.LOG);

    const isMoveSeen = await watch.waitAsync(FolderWatchTests.LIMIT, () => false);
    const isChangeSeen = await FolderWatchTests.changeUntilWokenAsync(watch, () => writeFile(path.join(target, "runtime.json"), "{}"));

    Assert.areEqual([folder.path, target].join(","), watches.folders.join(","));
    Assert.isTrue(isMoveSeen, "the move ends the first wait at once, not its timeout");
    Assert.isTrue(isChangeSeen, "the change in the folder ends the next wait, not its timeout");
  }

  @TestMethod
  public async checksEveryTickWhenTheFolderCannotBeWatched(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using _watches = new WatchPatchFixture(0);
    const logged: string[] = [];
    using watch = FolderWatch.open(folder.path, t => logged.push(t), 1);

    const woken = [await watch.waitAsync(FolderWatchTests.LIMIT, () => false), await watch.waitAsync(FolderWatchTests.LIMIT, () => false)];

    Assert.areEqual("true,true", woken.join(","), "the check ticks end the waits, not their timeout");
    Assert.areEqual(JSON.stringify([`The folder ${folder.path} could not be watched for changes, so the launcher checks it every 1 ms instead: ` +
      `Error: ENOSPC: System limit for number of file watchers reached, watch '${folder.path}'`]), JSON.stringify(logged));
  }

  @TestMethod
  public async checksEveryTickOnceTheWatchFailsDuringAWait(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using watches = new WatchPatchFixture();
    const logged: string[] = [];
    using watch = FolderWatch.open(folder.path, t => logged.push(t), 1);
    const waiting = watch.waitAsync(FolderWatchTests.LIMIT, () => false);

    watches.fail(new Error("EPERM: operation not permitted, watch"));
    const isFailureSeen = await waiting;
    watches.fail(new Error("EPERM: operation not permitted, watch"));
    const isTickSeen = await watch.waitAsync(FolderWatchTests.LIMIT, () => false);

    Assert.areEqual("true,true", [isFailureSeen, isTickSeen].join(","), "the failure and then the check ticks end the waits, not their timeout");
    Assert.areEqual(JSON.stringify([`The folder ${folder.path} could not be watched for changes, so the launcher checks it every 1 ms instead: ` +
      "Error: EPERM: operation not permitted, watch"]), JSON.stringify(logged));
  }

  @TestMethod
  public async checksEveryTickOnceTheFolderItFollowsCannotBeWatched(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using _watches = new WatchPatchFixture(1);
    const target = path.join(folder.path, "data");
    const logged: string[] = [];
    using watch = FolderWatch.open(target, t => logged.push(t));
    const woken: boolean[] = [];

    await mkdir(target);
    while (logged.length === 0 && !woken.includes(false))
      woken.push(await FolderWatchTests.changeUntilWokenAsync(watch, () => writeFile(path.join(folder.path, "other.txt"), "other")));
    woken.push(await watch.waitAsync(FolderWatchTests.LIMIT, () => false));

    Assert.isFalse(woken.includes(false), "the failure and then the check ticks end the waits, not their timeout");
    Assert.areEqual(1, logged.length);
    Assert.isTrue(logged[0]?.startsWith(`The folder ${target} could not be watched for changes, so the launcher checks it every 100 ms instead: Error: ENOSPC`) === true,
      String(logged[0]));
  }

  private static async changeUntilWokenAsync(watch: FolderWatch, change: () => Promise<void>): Promise<boolean> {
    const state = { isWoken: false };
    const waiting = watch.waitAsync(FolderWatchTests.LIMIT, () => false).finally(() => {
      state.isWoken = true;
    });
    while (!state.isWoken)
      await change();
    return await waiting;
  }
}
