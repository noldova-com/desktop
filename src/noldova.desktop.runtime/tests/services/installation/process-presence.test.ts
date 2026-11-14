/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateProcess } from "@noldova/desktop.protocol";
import { ProcessPresence } from "@noldova/desktop.runtime";

import { ProcessTableFixture } from "../../fixtures/process-table.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

@TestClass
export class ProcessPresenceTests {
  private static readonly WINDOWS_TABLE: string = "4120\t1\t1500000\t\n4188\t4120\t1600000\t";

  @TestMethod
  public async findsTheRunningTestProcess(): Promise<void> {
    const presence = ProcessPresence.create(process.platform);

    const [stamp] = await presence.stampAsync([[process.pid, "cli"]]);

    Assert.isDefined(stamp);
    Assert.areEqual(`${process.pid} cli`, `${stamp.processId} ${stamp.role}`);
    Assert.isTrue(await presence.isRunningAsync(stamp));
  }

  @TestMethod
  public async stampsTheProcessesTheTableListsWithTheRangeTheirStartFallsIn(): Promise<void> {
    const windows = new WindowsProcessApiFixture([ProcessPresenceTests.WINDOWS_TABLE]);
    const presence = new ProcessPresence("win32", new ProcessTableFixture([]), windows);

    const stamps = await presence.stampAsync([[4188, "program"], [4999, "cli"], [4120, "main"]]);

    Assert.areEqual("4188 1599950 1600050 program|4120 1499950 1500050 main", stamps.map(t => `${t.processId} ${t.earliest} ${t.latest} ${t.role}`).join("|"));
    Assert.areEqual(1, windows.listings);
    Assert.areEqual(0, windows.openHandles);
  }

  @TestMethod
  public async readsNoTableToStampNoProcesses(): Promise<void> {
    const table = new ProcessTableFixture([]);
    const presence = new ProcessPresence("darwin", table, new WindowsProcessApiFixture());

    Assert.areEqual(0, (await presence.stampAsync([])).length);
    Assert.areEqual(0, table.reads);
  }

  @TestMethod
  public async readsNothingOfAnyPlatformUntilItChecksAProcess(): Promise<void> {
    const table = new ProcessTableFixture([]);
    const windows = new WindowsProcessApiFixture();
    const presences = ["linux", "darwin", "win32"].map(t => new ProcessPresence(t, table, windows));

    const stamps = await Promise.all(presences.map(t => t.stampAsync([])));

    Assert.areEqual("0 0 0", stamps.map(t => t.length).join(" "));
    Assert.areEqual(0, table.reads);
    Assert.areEqual(0, windows.listings);
  }

  @TestMethod
  public async findsAProcessOnlyWhenItsIdIsListedWithAStartThatCanFallInItsRange(): Promise<void> {
    const table = ProcessPresenceTests.WINDOWS_TABLE;
    const presence = new ProcessPresence("win32", new ProcessTableFixture([]), new WindowsProcessApiFixture([table, table, table, table]));

    const results = [
      await presence.isRunningAsync(new UpdateProcess(4120, 1500050, 1500100, "main")),
      await presence.isRunningAsync(new UpdateProcess(4120, 1499900, 1499950, "main")),
      await presence.isRunningAsync(new UpdateProcess(4120, 1500051, 1500100, "main")),
      await presence.isRunningAsync(new UpdateProcess(4999, 1500000, 1500000, "main"))
    ];

    Assert.areEqual("true true false false", results.join(" "));
  }

  @TestMethod
  public async readsThePosixTableThroughItsApiWithAStartRangeOfASecondEachWay(): Promise<void> {
    const table = new ProcessTableFixture(["4120 1 4120 01:00\n", "4120 1 4120 01:00\n"], () => 1_060_000);
    const presence = new ProcessPresence("darwin", table, new WindowsProcessApiFixture());

    const [stamp] = await presence.stampAsync([[4120, "main"]]);

    Assert.isDefined(stamp);
    Assert.areEqual("999000 1001000", `${stamp.earliest} ${stamp.latest}`);
    Assert.isTrue(await presence.isRunningAsync(stamp));
    Assert.areEqual(2, table.reads);
  }
}
