/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { InstallationWatch } from "../../src/services/installation-watch.js";
import { CliFixture } from "../fixtures/cli.fixture.js";
import { WatchLimitFixture } from "../fixtures/watch-limit.fixture.js";
import { WatchPatchFixture } from "../fixtures/watch-patch.fixture.js";

@TestClass
export class InstallationWatchTests {
  private static readonly LIMIT: number = 2_147_483_647;

  @TestMethod
  public async wakesWhenTheBarrierIsRemoved(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const folder = await InstallationWatchTests.createFolderAsync(fixture);
    const barrier = path.join(folder, "barrier.json");
    await writeFile(barrier, "{}");
    const logs: string[] = [];
    using watch = new InstallationWatch(folder, t => logs.push(t), InstallationWatchTests.LIMIT);
    const state = { isWoken: false };
    const waiting = watch.waitAsync(InstallationWatchTests.LIMIT).then(() => {
      state.isWoken = true;
    });

    while (!state.isWoken) {
      await rm(barrier);
      await writeFile(barrier, "{}");
    }
    await waiting;

    Assert.areEqual(0, logs.length);
  }

  @TestMethod
  public async keepsAChangeThatCameBeforeTheWait(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const folder = await InstallationWatchTests.createFolderAsync(fixture);
    using watches = new WatchPatchFixture();
    const logs: string[] = [];
    using watch = new InstallationWatch(folder, t => logs.push(t), InstallationWatchTests.LIMIT);

    watches.change();
    await watch.waitAsync(InstallationWatchTests.LIMIT);

    Assert.areEqual(folder, watches.folders.join("|"));
    Assert.areEqual(0, logs.length);
  }

  @TestMethod
  public async checksOnTheTimerAndLogsOnceWhenTheFolderCannotBeWatched(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const folder = await InstallationWatchTests.createFolderAsync(fixture);
    using _watches = new WatchLimitFixture();
    const logs: string[] = [];
    using watch = new InstallationWatch(folder, t => logs.push(t), 1);

    await watch.waitAsync(InstallationWatchTests.LIMIT);
    await watch.waitAsync(InstallationWatchTests.LIMIT);

    Assert.areEqual(1, logs.length);
    Assert.isTrue(logs.join("|").startsWith(`The folder ${folder} could not be watched for changes, so the command line checks whether the update has ended every 1 ms instead: Error: ENOSPC`),
      logs.join("|"));
  }

  @TestMethod
  public async wakesAndLogsWhenTheWatchFailsDuringTheWait(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const folder = await InstallationWatchTests.createFolderAsync(fixture);
    using watches = new WatchPatchFixture();
    const logs: string[] = [];
    using watch = new InstallationWatch(folder, t => logs.push(t), InstallationWatchTests.LIMIT);
    const waiting = watch.waitAsync(InstallationWatchTests.LIMIT);

    watches.fail(new Error("EPERM: operation not permitted"));
    await waiting;

    Assert.areEqual(`The folder ${folder} could not be watched for changes, so the command line checks whether the update has ended every ${InstallationWatchTests.LIMIT} ms instead: Error: EPERM: operation not permitted`,
      logs.join("|"));
  }

  @TestMethod
  public async logsAWatchThatFailedBeforeTheWaitAndChecksOnTheTimer(): Promise<void> {
    await using fixture = await CliFixture.createAsync();
    const folder = await InstallationWatchTests.createFolderAsync(fixture);
    using watches = new WatchPatchFixture();
    const logs: string[] = [];
    using watch = new InstallationWatch(folder, t => logs.push(t), 1);

    watches.fail(new Error("EPERM: operation not permitted"));
    await watch.waitAsync(InstallationWatchTests.LIMIT);

    Assert.areEqual(`The folder ${folder} could not be watched for changes, so the command line checks whether the update has ended every 1 ms instead: Error: EPERM: operation not permitted`,
      logs.join("|"));
  }

  private static async createFolderAsync(fixture: CliFixture): Promise<string> {
    const folder = path.join(fixture.root, "installation");
    await mkdir(folder, { recursive: true });
    return folder;
  }
}
