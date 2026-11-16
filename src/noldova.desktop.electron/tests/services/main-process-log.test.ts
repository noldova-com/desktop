/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MainProcessLog } from "@noldova/desktop.electron";
import { DataDirectory, DiagnosticRedactor } from "@noldova/desktop.runtime";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeMainProcessEnvironment } from "../fixtures/fake-main-process-environment.fixture.js";

@TestClass
export class MainProcessLogTests {
  private static readonly MOMENT: Date = new Date("2026-10-02T23:40:01.250Z");
  private static readonly TOKEN: string = "a1B2_c3D4-".repeat(4);

  @TestMethod
  public async stampsAndRedactsEveryLineAndKeepsItOnStandardErrorOnlyUntilTheFileOpens(): Promise<void> {
    await MainProcessLogTests.runAsync(async (folder, directory) => {
      const process = new FakeMainProcessEnvironment("linux");
      const log = new MainProcessLog(directory, process.errorOutput, new DiagnosticRedactor(folder), () => MainProcessLogTests.MOMENT);

      log.write("Before the file.");
      await log.openAsync();
      log.write(`Saved in ${path.join(folder, "notes")} with ${MainProcessLogTests.TOKEN}.`);
      log.flush();

      const later = `2026-10-02T23:40:01.250Z Saved in ${path.join("~", "notes")} with [redacted].\n`;
      Assert.areEqual(`2026-10-02T23:40:01.250Z Before the file.\n${later}`, process.errors);
      Assert.areEqual(later, await readFile(directory.mainProcessLog, "utf8"));
    });
  }

  @TestMethod
  public async putsALineKeptBeforeTheFileOpensInTheFileFirstAndAnyLaterKeptLineAtOnce(): Promise<void> {
    await MainProcessLogTests.runAsync(async (folder, directory) => {
      const process = new FakeMainProcessEnvironment("linux");
      const log = new MainProcessLog(directory, process.errorOutput, new DiagnosticRedactor(folder), () => MainProcessLogTests.MOMENT);

      log.writeKept("Kept for the file.");
      log.write("Before the file.");
      await log.openAsync();
      log.write("In the file.");
      log.writeKept("Kept again.");
      await log.openAsync();
      log.flush();

      const lines = ["Kept for the file.", "Before the file.", "In the file.", "Kept again."].map(t => `2026-10-02T23:40:01.250Z ${t}\n`);
      Assert.areEqual(lines.join(String.empty), process.errors);
      Assert.areEqual([lines[0], lines[2], lines[3]].join(String.empty), await readFile(directory.mainProcessLog, "utf8"));
    });
  }

  @TestMethod
  public async putsTheLinesWrittenWhileTheFileOpensInTheFileAfterTheKeptOnes(): Promise<void> {
    await MainProcessLogTests.runAsync(async (folder, directory) => {
      const process = new FakeMainProcessEnvironment("linux");
      const log = new MainProcessLog(directory, process.errorOutput, new DiagnosticRedactor(folder), () => MainProcessLogTests.MOMENT);
      log.writeKept("Kept for the file.");

      const opening = log.openAsync();
      log.write("While the file opens.");
      log.writeKept("Kept while the file opens.");
      await opening;
      log.write("Once open.");
      log.flush();

      const lines = ["Kept for the file.", "While the file opens.", "Kept while the file opens.", "Once open."].map(t => `2026-10-02T23:40:01.250Z ${t}\n`);
      Assert.areEqual(lines.join(String.empty), process.errors);
      Assert.areEqual(lines.join(String.empty), await readFile(directory.mainProcessLog, "utf8"));
    });
  }

  @TestMethod
  public async keepsExactlyOnePreviousLogAndStartsOnlyOncePerMainProcess(): Promise<void> {
    await MainProcessLogTests.runAsync(async (folder, directory) => {
      for (const start of ["first", "second", "third"]) {
        const log = new MainProcessLog(directory, new FakeMainProcessEnvironment("linux").errorOutput, new DiagnosticRedactor(folder), () => MainProcessLogTests.MOMENT);
        await log.openAsync();
        log.write(start);
        await log.openAsync();
        log.write(`${start} again`);
        log.flush();
      }

      Assert.areEqual("main.log,main.previous.log", (await readdir(directory.logsFolder)).sort().join(","));
      Assert.areEqual("2026-10-02T23:40:01.250Z third\n2026-10-02T23:40:01.250Z third again\n", await readFile(directory.mainProcessLog, "utf8"));
      Assert.areEqual("2026-10-02T23:40:01.250Z second\n2026-10-02T23:40:01.250Z second again\n", await readFile(directory.previousMainProcessLog, "utf8"));
    });
  }

  @TestMethod
  public async writesWithoutWaitingForTheFileAndWritesTheWaitingLinesAtOnceWhenFlushed(): Promise<void> {
    await MainProcessLogTests.runAsync(async (folder, directory) => {
      const log = new MainProcessLog(directory, new FakeMainProcessEnvironment("linux").errorOutput, new DiagnosticRedactor(folder), () => MainProcessLogTests.MOMENT);
      await log.openAsync();
      const lines = ["first", "second"].map(t => `2026-10-02T23:40:01.250Z ${t}\n`);

      log.write("first");
      log.write("second");
      const before = readFileSync(directory.mainProcessLog, "utf8");
      log.flush();

      Assert.areNotEqual(lines.join(String.empty), before);
      Assert.areEqual(lines.join(String.empty), readFileSync(directory.mainProcessLog, "utf8"));
    });
  }

  @TestMethod
  public async becomesThePreviousLogInsteadOfPassingItsSizeLimit(): Promise<void> {
    await MainProcessLogTests.runAsync(async (folder, directory) => {
      const log = new MainProcessLog(directory, new FakeMainProcessEnvironment("linux").errorOutput, new DiagnosticRedactor(folder), () => MainProcessLogTests.MOMENT);
      await log.openAsync();

      for (let i = 0; i < 5; i++)
        log.write(`${i}${"word ".repeat(60000)}`);
      log.flush();

      Assert.isTrue((await stat(directory.mainProcessLog)).size <= 1048576);
      Assert.isTrue((await readFile(directory.mainProcessLog, "utf8")).includes(" 4word"));
      Assert.isTrue((await readFile(directory.previousMainProcessLog, "utf8")).includes(" 3word"));
    });
  }

  @TestMethod
  public async writesToStandardErrorOnlyWhenTheDirectoryIsNotUsable(): Promise<void> {
    await MainProcessLogTests.runAsync(async folder => {
      const missing = new DataDirectory(path.join(folder, "missing"));
      const blocked = new DataDirectory(path.join(folder, "blocked"));
      await mkdir(blocked.root);
      await writeFile(blocked.logsFolder, String.empty);
      const missingProcess = new FakeMainProcessEnvironment("linux");
      const blockedProcess = new FakeMainProcessEnvironment("linux");
      const missingLog = new MainProcessLog(missing, missingProcess.errorOutput, new DiagnosticRedactor(folder));
      const blockedLog = new MainProcessLog(blocked, blockedProcess.errorOutput, new DiagnosticRedactor(folder));

      missingLog.writeKept("Kept for a file that never starts.");
      await missingLog.openAsync();
      await blockedLog.openAsync();
      missingLog.write("Still recorded.");

      Assert.isFalse(existsSync(missing.root));
      Assert.areEqual(3, missingProcess.errors.split("\n").length - 1);
      Assert.isTrue(missingProcess.errors.includes(" The main process's log could not be written, so its records go to standard error only: Error: "));
      Assert.isTrue(missingProcess.errors.endsWith(" Still recorded.\n"));
      Assert.isTrue(blockedProcess.errors.includes(" The main process's log could not be written, so its records go to standard error only: Error: "));
    });
  }

  @TestMethod
  public async goesOnOnStandardErrorWhenTheFileCanNoLongerBeWritten(): Promise<void> {
    await MainProcessLogTests.runAsync(async (folder, directory) => {
      const process = new FakeMainProcessEnvironment("linux");
      const log = new MainProcessLog(directory, process.errorOutput, new DiagnosticRedactor(folder));
      await log.openAsync();
      await rm(directory.logsFolder, { recursive: true });

      log.write("Lost from the file.");
      log.write("Lost too.");
      await Condition.waitAsync(() => process.errors.includes("The main process's log could not be written"));
      log.write("Only on standard error.");
      log.flush();

      Assert.isFalse(existsSync(directory.logsFolder));
      const lines = process.errors.trimEnd().split("\n").map(t => t.slice(t.indexOf(" ") + 1));
      Assert.areEqual("Lost from the file.", lines[0]);
      Assert.areEqual("Lost too.", lines[1]);
      Assert.isTrue(lines[2]?.startsWith("The main process's log could not be written, so its records go to standard error only: Error: ") === true);
      Assert.areEqual("Only on standard error.", lines[3]);
      Assert.areEqual(4, lines.length);
    });
  }

  @TestMethod
  public async writesASharedLineAtTheEndOfTheCurrentFileWithoutStartingItAndSaysWhyWhenItCannot(): Promise<void> {
    await MainProcessLogTests.runAsync(async (folder, directory) => {
      const missing = new FakeMainProcessEnvironment("linux");
      const owning = new FakeMainProcessEnvironment("linux");
      new MainProcessLog(directory, missing.errorOutput, new DiagnosticRedactor(folder), () => MainProcessLogTests.MOMENT).writeShared("No folder yet.");
      await mkdir(directory.logsFolder);
      await writeFile(directory.mainProcessLog, "The owner's line.\n");

      new MainProcessLog(directory, owning.errorOutput, new DiagnosticRedactor(folder), () => MainProcessLogTests.MOMENT).writeShared(`Quit in ${path.join(folder, "data")}.`);

      const shared = `2026-10-02T23:40:01.250Z Quit in ${path.join("~", "data")}.\n`;
      Assert.areEqual(`The owner's line.\n${shared}`, await readFile(directory.mainProcessLog, "utf8"));
      Assert.areEqual("main.log", (await readdir(directory.logsFolder)).join(","));
      Assert.areEqual(shared, owning.errors);
      const errors = missing.errors.split("\n");
      Assert.areEqual("2026-10-02T23:40:01.250Z No folder yet.", errors[0]);
      Assert.isTrue(errors[1]?.startsWith("2026-10-02T23:40:01.250Z The main process's log could not be written, so its records go to standard error only: Error: ENOENT") === true,
        missing.errors);
    });
  }

  private static async runAsync(test: (folder: string, directory: DataDirectory) => Promise<void>): Promise<void> {
    const folder = await mkdtemp(path.join(os.tmpdir(), "desktop-main-process-log-"));
    try {
      const directory = new DataDirectory(path.join(folder, "data"));
      await mkdir(directory.root);
      await test(folder, directory);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
