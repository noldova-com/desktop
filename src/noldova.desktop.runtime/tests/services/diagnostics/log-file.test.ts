/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DiagnosticRedactor, LogFile } from "@noldova/desktop.runtime";

import { ClosePatchFixture } from "../../fixtures/close-patch.fixture.js";
import { ShortWriteFixture } from "../../fixtures/short-write.fixture.js";
import { SlowWriteFixture } from "../../fixtures/slow-write.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class LogFileTests {
  private static readonly MOMENT: Date = new Date("2026-10-02T23:40:01.250Z");
  private static readonly STAMP: string = "2026-10-02T23:40:01.250Z";
  private static readonly LIMIT: number = 160;
  private static readonly WRITE_WAIT: number = 60_000;

  @TestMethod
  public stampsRedactsAndEndsEveryRecord(): void {
    const log = new LogFile("log", "previous", new DiagnosticRedactor("/home/person"), () => LogFileTests.MOMENT);

    Assert.areEqual(`${LogFileTests.STAMP} in ~/notes with [redacted]\nand more\n`, log.format(`in /home/person/notes with ${"a1B2_c3D4-".repeat(4)}\nand more`));
  }

  @TestMethod
  public cutsARecordToAQuarterOfTheLimit(): void {
    const log = new LogFile("log", "previous", new DiagnosticRedactor("/home/person"), () => LogFileTests.MOMENT, LogFileTests.LIMIT);

    const line = log.format("word ".repeat(LogFileTests.LIMIT));

    Assert.areEqual(LogFileTests.LIMIT / 4, line.length);
    Assert.isTrue(line.startsWith(`${LogFileTests.STAMP} word`));
    Assert.isTrue(line.endsWith("word\n"));
  }

  @TestMethod
  public cutsAMultibyteRecordUnderItsByteLimitAtACharacterBoundary(): void {
    const log = new LogFile("log", "previous", new DiagnosticRedactor("/home/person"), () => LogFileTests.MOMENT, LogFileTests.LIMIT);

    const euros = log.format("€ ".repeat(LogFileTests.LIMIT));
    const faces = log.format("😀 ".repeat(LogFileTests.LIMIT));

    Assert.areEqual(`${LogFileTests.STAMP} € € € \n`, euros);
    Assert.areEqual(`${LogFileTests.STAMP} 😀 😀 😀\n`, faces);
    Assert.isTrue(Buffer.byteLength(euros) <= LogFileTests.LIMIT / 4);
    Assert.isTrue(Buffer.byteLength(faces) <= LogFileTests.LIMIT / 4);
  }

  @TestMethod
  public becomesThePreviousFileInsteadOfPassingItsLimit(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file, previous) => {
      const lines = Array.from({ length: 9 }, (_, i) => log.format(`record ${i + 1}`));
      Assert.areEqual(34, lines[0]?.length);
      log.open();

      for (const line of lines) {
        log.append(line);
        Assert.isTrue((await stat(file)).size <= LogFileTests.LIMIT);
      }

      Assert.areEqual(lines.slice(8).join(String.empty), await readFile(file, "utf8"));
      Assert.areEqual(lines.slice(4, 8).join(String.empty), await readFile(previous, "utf8"));
    });
  }

  @TestMethod
  public keepsTheFileAndThrowsWhenThePreviousCannotBeReplaced(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file, previous) => {
      const lines = Array.from({ length: 5 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      for (const line of lines.slice(0, 4))
        log.append(line);
      await mkdir(path.join(previous, "held"), { recursive: true });

      Assert.throws(() => log.append(lines[4] ?? String.empty), Error);
      Assert.throws(() => log.open(), Error);

      Assert.areEqual(lines.slice(0, 4).join(String.empty), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public replacesTheExistingFileWhenOpened(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file, previous) => {
      await writeFile(previous, "oldest\n");
      await writeFile(file, "older\n");

      log.open();

      Assert.areEqual(String.empty, await readFile(file, "utf8"));
      Assert.areEqual("older\n", await readFile(previous, "utf8"));
    });
  }

  @TestMethod
  public writesLinesInTheOrderTheyWereAppendedWithoutWaitingForTheDisk(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file) => {
      const lines = Array.from({ length: 3 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();

      const written = lines.map(t => log.appendAsync(t));
      await Promise.all(written);

      Assert.areEqual(lines.join(String.empty), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public losesNoWaitingLineWhenTheFileBecomesThePreviousFile(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file, previous) => {
      const lines = Array.from({ length: 9 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();

      const written = lines.map(t => log.appendAsync(t));
      await log.flushAsync();
      await Promise.all(written);

      Assert.areEqual(lines.slice(8).join(String.empty), await readFile(file, "utf8"));
      Assert.areEqual(lines.slice(4, 8).join(String.empty), await readFile(previous, "utf8"));
    });
  }

  @TestMethod
  public writesALineAtOnceAfterTheLinesBeforeItEvenWhileOneIsBeingWritten(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file) => {
      const lines = Array.from({ length: 3 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      using slow = new SlowWriteFixture(false);

      const written = [log.appendAsync(lines[0] ?? String.empty), log.appendAsync(lines[1] ?? String.empty)];
      await slow.calledAsync(1);
      log.append(lines[2] ?? String.empty);
      const atOnce = readFileSync(file, "utf8");
      await Promise.all(written);

      Assert.areEqual(1, slow.calls);
      Assert.areEqual(lines.join(String.empty), atOnce);
      Assert.areEqual(lines.join(String.empty), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public writesALineAtOnceWhenTheLineBeingWrittenDoesNotLandInTime(): Promise<void> {
    return LogFileTests.runAsync(0, async (log, file) => {
      const lines = Array.from({ length: 2 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      using held = new SlowWriteFixture(true);

      const first = log.appendAsync(lines[0] ?? String.empty);
      await held.calledAsync(1);
      log.append(lines[1] ?? String.empty);
      const atOnce = readFileSync(file, "utf8");
      held.release();
      await first;

      Assert.areEqual(lines[1], atOnce);
      Assert.areEqual(`${lines[1]}${lines[0]}`, await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public waitsForTheLineBeingWrittenThoughAnotherProcessAppendedToTheFile(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file) => {
      const lines = Array.from({ length: 2 }, (_, i) => log.format(`record ${i + 1}`));
      const shared = "Another main process was refused the lock and wrote this.\n";
      log.open();
      appendFileSync(file, shared);
      using slow = new SlowWriteFixture(false);

      const first = log.appendAsync(lines[0] ?? String.empty);
      await slow.calledAsync(1);
      log.append(lines[1] ?? String.empty);
      const atOnce = readFileSync(file, "utf8");
      await first;

      Assert.areEqual(1, slow.calls);
      Assert.areEqual(`${shared}${lines.join(String.empty)}`, atOnce);
    });
  }

  @TestMethod
  public findsALaterLineBeingWrittenAfterALineWrittenAtOnceRollsOverDuringAWrite(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file, previous) => {
      const lines = Array.from({ length: 7 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      for (const line of lines.slice(0, 3))
        log.append(line);
      using slow = new SlowWriteFixture(false);

      const during = log.appendAsync(lines[3] ?? String.empty);
      await slow.calledAsync(1);
      log.append(lines[4] ?? String.empty);
      await during;
      const later = log.appendAsync(lines[5] ?? String.empty);
      await slow.calledAsync(2);
      log.append(lines[6] ?? String.empty);
      const atOnce = readFileSync(file, "utf8");
      await later;

      Assert.areEqual(2, slow.calls);
      Assert.areEqual(lines.slice(0, 4).join(String.empty), await readFile(previous, "utf8"));
      Assert.areEqual(lines.slice(4).join(String.empty), atOnce);
    });
  }

  @TestMethod
  public keepsTheOrderAfterALineItCouldNotWrite(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file) => {
      const lines = Array.from({ length: 3 }, (_, i) => log.format(`record ${i + 1}`));

      await mkdir(file);
      await Assert.throwsAsync(() => log.appendAsync(lines[0] ?? String.empty), Error);
      await rm(file, { recursive: true });
      await writeFile(file, String.empty);
      using slow = new SlowWriteFixture(false);
      const second = log.appendAsync(lines[1] ?? String.empty);
      await slow.calledAsync(1);
      log.append(lines[2] ?? String.empty);
      const atOnce = readFileSync(file, "utf8");
      await second;

      Assert.areEqual(1, slow.calls);
      Assert.areEqual(lines.slice(1).join(String.empty), atOnce);
    });
  }

  @TestMethod
  public writesALineAtOnceWhenTheFileIsGoneWhileALineIsBeingWritten(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file) => {
      const lines = Array.from({ length: 2 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      using held = new SlowWriteFixture(true);

      const first = log.appendAsync(lines[0] ?? String.empty);
      await held.calledAsync(1);
      await rm(file);
      log.append(lines[1] ?? String.empty);
      const atOnce = readFileSync(file, "utf8");
      held.release();
      await first;

      Assert.areEqual(lines[1], atOnce);
      Assert.areEqual(lines[1], await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public rejectsALineWhoseWriteFailsAndStillWritesTheNextOne(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file) => {
      const lines = Array.from({ length: 2 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      using held = new SlowWriteFixture(true);

      const first = log.appendAsync(lines[0] ?? String.empty);
      held.fail(Object.assign(new Error("EIO: the disk failed."), { code: "EIO" }));
      await Assert.throwsAsync(() => first, Error);
      await log.appendAsync(lines[1] ?? String.empty);

      Assert.areEqual(lines[1], await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public writesTheRestOfALineTheSystemWroteOnlyPartOf(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file) => {
      const line = log.format("record 1");
      log.open();
      using short = new ShortWriteFixture();

      await log.appendAsync(line);

      Assert.areEqual(Buffer.byteLength(line), short.lengths[0]);
      Assert.isTrue(short.lengths.length > 1);
      Assert.areEqual(line, await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public rejectsALineWhoseFileCannotBeClosedThoughItsTextLanded(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file) => {
      const lines = Array.from({ length: 2 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      {
        using failing = new ClosePatchFixture(Object.assign(new Error("EIO: the disk failed."), { code: "EIO" }));
        await Assert.throwsAsync(() => log.appendAsync(lines[0] ?? String.empty), Error);
        Assert.areEqual(1, failing.calls);
      }

      await log.appendAsync(lines[1] ?? String.empty);

      Assert.areEqual(lines.join(String.empty), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public writesALineAtOnceAfterALineWhoseFileIsStillOpening(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file) => {
      const lines = Array.from({ length: 2 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      using closes = new ClosePatchFixture(null);

      const first = log.appendAsync(lines[0] ?? String.empty);
      log.append(lines[1] ?? String.empty);
      const atOnce = readFileSync(file, "utf8");
      await first;
      await log.flushAsync();

      Assert.areEqual(1, closes.calls);
      Assert.areEqual(lines.join(String.empty), atOnce);
      Assert.areEqual(lines.join(String.empty), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public async rejectsALineItCannotWriteAndStillWritesTheNextOne(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "logs", "app.log");
    const log = new LogFile(file, path.join(folder.path, "logs", "app.previous.log"), new DiagnosticRedactor("/home/person"), () => LogFileTests.MOMENT);
    const lines = [log.format("lost"), log.format("kept")];

    await Assert.throwsAsync(() => log.appendAsync(lines[0] ?? String.empty), Error);
    await mkdir(path.dirname(file));
    await log.appendAsync(lines[1] ?? String.empty);

    Assert.areEqual(lines[1], await readFile(file, "utf8"));
  }

  @TestMethod
  public rejectsTheWaitingLinesWhenThePreviousCannotBeReplacedAndKeepsTheFile(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file, previous) => {
      const lines = Array.from({ length: 5 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      await Promise.all(lines.slice(0, 4).map(t => log.appendAsync(t)));
      await mkdir(path.join(previous, "held"), { recursive: true });

      await Assert.throwsAsync(() => log.appendAsync(lines[4] ?? String.empty), Error);

      Assert.areEqual(lines.slice(0, 4).join(String.empty), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public settlesEachWaitingLineWhenWritingThemAtOnce(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file, previous) => {
      const lines = Array.from({ length: 5 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      await mkdir(path.join(previous, "held"), { recursive: true });
      using slow = new SlowWriteFixture(false);
      const written = lines.map(t => log.appendAsync(t));
      await slow.calledAsync(1);

      log.flush();

      await Assert.throwsAsync(() => written[4] ?? Promise.resolve(), Error);
      await Promise.all(written.slice(0, 4));
      Assert.areEqual(1, slow.calls);
      Assert.areEqual(lines.slice(0, 4).join(String.empty), await readFile(file, "utf8"));
    });
  }

  @TestMethod
  public settlesEachWaitingLineWhenTheFirstWriteEndsBeforeWritingThemAtOnce(): Promise<void> {
    return LogFileTests.runAsync(LogFileTests.WRITE_WAIT, async (log, file, previous) => {
      const lines = Array.from({ length: 5 }, (_, i) => log.format(`record ${i + 1}`));
      log.open();
      await mkdir(path.join(previous, "held"), { recursive: true });
      using slow = new SlowWriteFixture(false);
      const written = lines.map(t => log.appendAsync(t));
      await slow.calledAsync(2);

      log.flush();

      await Assert.throwsAsync(() => written[4] ?? Promise.resolve(), Error);
      await Promise.all(written.slice(0, 4));
      Assert.areEqual(2, slow.calls);
      Assert.areEqual(lines.slice(0, 4).join(String.empty), await readFile(file, "utf8"));
    });
  }

  private static async runAsync(writeWait: number, test: (log: LogFile, file: string, previous: string) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "app.log");
    const previous = path.join(folder.path, "app.previous.log");
    await test(new LogFile(file, previous, new DiagnosticRedactor("/home/person"), () => LogFileTests.MOMENT, LogFileTests.LIMIT, writeWait), file, previous);
  }
}
