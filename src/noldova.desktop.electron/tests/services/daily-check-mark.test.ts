/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DailyCheckMark } from "@noldova/desktop.electron";

@TestClass
export class DailyCheckMarkTests {
  @TestMethod
  public formatsTheLocalDate(): void {
    Assert.areEqual("2026-01-05 2026-11-08", [new Date(2026, 0, 5, 23, 59), new Date(2026, 10, 8, 0, 0)].map(t => DailyCheckMark.formatDate(t)).join(" "));
  }

  @TestMethod
  public marksTheFirstCheckOfEachLocalDayAndStoresOnlyItsDate(): Promise<void> {
    return DailyCheckMarkTests.withFolderAsync(async folder => {
      const file = join(folder, "updates", "last-daily-update-check");
      let now = new Date(2026, 10, 8, 9);
      const mark = new DailyCheckMark(file, () => now, () => undefined);

      const first = [await mark.takeAsync(), await mark.takeAsync()];
      await mark.recordAsync();
      const stored = await readFile(file, "utf8");
      now = new Date(2026, 10, 8, 23, 59);
      const late = await mark.takeAsync();
      now = new Date(2026, 10, 9, 0, 1);
      const next = [await mark.takeAsync(), await mark.takeAsync()];
      await mark.recordAsync();

      Assert.areEqual("true false 2026-11-08 false true false", [...first, stored, late, ...next].join(" "));
      Assert.areEqual("2026-11-09", await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public readsTheDateALaterStartLeft(): Promise<void> {
    return DailyCheckMarkTests.withFolderAsync(async folder => {
      const file = join(folder, "last-daily-update-check");
      await writeFile(file, "2026-11-08\n");
      const today = new DailyCheckMark(file, () => new Date(2026, 10, 8, 18), () => undefined);
      const tomorrow = new DailyCheckMark(file, () => new Date(2026, 10, 9, 8), () => undefined);

      Assert.areEqual("false true", [await today.takeAsync(), await tomorrow.takeAsync()].join(" "));
    });
  }

  @TestMethod
  public readsTheFileOnEveryTakeSoTwoMainProcessesNeverMarkTheSameDay(): Promise<void> {
    return DailyCheckMarkTests.withFolderAsync(async folder => {
      const file = join(folder, "last-daily-update-check");
      let now = new Date(2026, 10, 8, 9);
      const first = new DailyCheckMark(file, () => now, () => undefined);
      const second = new DailyCheckMark(file, () => now, () => undefined);

      const dayOne = await first.takeAsync();
      await first.recordAsync();
      now = new Date(2026, 10, 9, 9);
      const dayTwo = await second.takeAsync();
      await second.recordAsync();
      const firstOnDayTwo = await first.takeAsync();

      Assert.areEqual("true true false", [dayOne, dayTwo, firstOnDayTwo].join(" "));
      Assert.areEqual("2026-11-09", await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public writesNothingUntilRecordedAndGivesAReleasedMarkToTheNextRequest(): Promise<void> {
    return DailyCheckMarkTests.withFolderAsync(async folder => {
      const file = join(folder, "last-daily-update-check");
      const mark = new DailyCheckMark(file, () => new Date(2026, 10, 8, 9), () => undefined);

      await mark.recordAsync();
      const taken = await mark.takeAsync();
      const isWritten = await access(file).then(() => true, () => false);
      mark.release();
      const retaken = [await mark.takeAsync(), await mark.takeAsync()];
      await mark.recordAsync();

      Assert.areEqual("true false true false", [taken, isWritten, ...retaken].join(" "));
      Assert.areEqual("2026-11-08", await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public givesTheMarkToOneOfTwoRequestsAtOnce(): Promise<void> {
    return DailyCheckMarkTests.withFolderAsync(async folder => {
      const mark = new DailyCheckMark(join(folder, "last-daily-update-check"), () => new Date(2026, 10, 8, 9), () => undefined);

      Assert.areEqual("true false false", (await Promise.all([mark.takeAsync(), mark.takeAsync(), mark.takeAsync()])).join(" "));
    });
  }

  @TestMethod
  public keepsTheMarkForTheProcessAndLogsWhenTheDateCannotBeRecorded(): Promise<void> {
    return DailyCheckMarkTests.withFolderAsync(async folder => {
      const blocked = join(folder, "blocked");
      await writeFile(blocked, "a file where a folder should be");
      const lines: string[] = [];
      const mark = new DailyCheckMark(join(blocked, "last-daily-update-check"), () => new Date(2026, 10, 8, 9), t => lines.push(t));

      const first = await mark.takeAsync();
      await mark.recordAsync();
      const taken = [first, await mark.takeAsync()];

      Assert.areEqual("true false", taken.join(" "));
      Assert.areEqual(1, lines.length);
      Assert.isTrue(lines[0]?.startsWith("The day's first update check could not be recorded, so a later start may mark today's check again: ") ?? false, lines[0]);
    });
  }

  private static async withFolderAsync(test: (folder: string) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(join(tmpdir(), "daily-check-mark-"));
    try {
      await test(folder);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
