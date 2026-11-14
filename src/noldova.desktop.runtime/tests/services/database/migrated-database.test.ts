/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataDirectory, Migration, ModuleDatabase } from "@noldova/desktop.runtime";

import { ErrorCodeFixture } from "../../fixtures/error-code.fixture.js";
import { FailedStatFixture } from "../../fixtures/failed-stat.fixture.js";
import { HeldOpenFixture } from "../../fixtures/held-open.fixture.js";
import { HeldRenameFixture } from "../../fixtures/held-rename.fixture.js";
import { ModuleDatabaseFixture } from "../../fixtures/module-database.fixture.js";
import { SyncFlushFixture } from "../../fixtures/sync-flush.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class MigratedDatabaseTests {
  private static readonly MOMENT: Date = new Date("2026-10-02T08:09:10.111Z");
  private static readonly LEVELS: Migration = new Migration("read-levels", [
    "CREATE TABLE levels (level INTEGER NOT NULL) STRICT",
    "INSERT INTO levels SELECT synchronous FROM pragma_synchronous"
  ]);
  private static readonly LEVELS_AGAIN: Migration = new Migration("read-levels-again", ["INSERT INTO levels SELECT synchronous FROM pragma_synchronous"]);
  private static readonly WAIT_LIMIT_MILLISECONDS: number = 5_000;

  @TestMethod
  public async createsWithoutFlushingMigratesWithoutFlushingEachCommitAndFlushesEachCommitOnceOpen(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const created = await ModuleDatabase.openAsync(directory, "levels", [MigratedDatabaseTests.LEVELS]);
    const createdLevel = String(created.read("PRAGMA synchronous")?.["synchronous"]);
    created.close();

    using reopened = await ModuleDatabase.openAsync(directory, "levels", [MigratedDatabaseTests.LEVELS, MigratedDatabaseTests.LEVELS_AGAIN]);

    Assert.areEqual("0,1", reopened.readAll("SELECT level FROM levels").map(t => String(t["level"])).join(","));
    Assert.areEqual("2", createdLevel);
    Assert.areEqual("2", String(reopened.read("PRAGMA synchronous")?.["synchronous"]));
  }

  @TestMethod
  public async flushesANewDatabasesFileBeforeItsFirstCommitButNotWhileItOpensNorAgain(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    const log = `${file}-wal`;
    using held = new HeldOpenFixture(file);
    using flushes = new SyncFlushFixture(() => String(statSync(log).size));
    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]);
    await new Promise(resolve => setImmediate(resolve));
    const logged = String(statSync(log).size);
    const opened = flushes.flushes.length;

    database.run("INSERT INTO notes (title) VALUES (?)", "First");
    database.transaction(() => database.run("INSERT INTO notes (title) VALUES (?)", "Second"));

    Assert.areEqual(0, opened);
    Assert.areEqual(logged, flushes.flushes.join(","));
    Assert.isTrue(statSync(log).size > Number(logged));
    Assert.areEqual(file, held.held.join(","));
    held.release();
    Assert.isTrue(await WaitFixture.untilAsync(() => held.settled === 2, MigratedDatabaseTests.WAIT_LIMIT_MILLISECONDS));
    Assert.areEqual(`${file},${log}`, held.held.join(","));
    database.close();
    using reopened = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]);
    reopened.run("INSERT INTO notes (title) VALUES (?)", "Third");
    Assert.areEqual(logged, flushes.flushes.join(","));
    Assert.areEqual(`${file},${log}`, held.held.join(","));
    Assert.areEqual("First,Second,Third", reopened.readAll("SELECT title FROM notes ORDER BY id").map(t => t["title"]).join(","));
  }

  @TestMethod
  public async refusesAFirstWriteWhoseFlushFailsAndFlushesAgainOnTheNext(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    using held = new HeldOpenFixture(directory.locateModuleDatabase("notes"));
    using flushes = new SyncFlushFixture(() => "flushed");
    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]);

    flushes.failOnce("EIO");
    const refused = Assert.throws(() => database.transaction(() => database.run("INSERT INTO notes (title) VALUES (?)", "Rolled back")), Error);
    flushes.failOnce("EIO");
    Assert.throws(() => database.run("INSERT INTO notes (title) VALUES (?)", "Never run"), Error);
    database.run("INSERT INTO notes (title) VALUES (?)", "Kept");
    database.run("INSERT INTO notes (title) VALUES (?)", "Kept too");

    Assert.areEqual("EIO: failed by the test", refused.message);
    Assert.areEqual("flushed,flushed,flushed", flushes.flushes.join(","));
    Assert.areEqual("Kept,Kept too", database.readAll("SELECT title FROM notes ORDER BY id").map(t => t["title"]).join(","));
    Assert.areEqual(0, held.settled);
  }

  @TestMethod
  public async flushesANewDatabasesFileBeforeAWriteThroughAReadAndRefusesItWhenThatFlushFails(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    const log = `${file}-wal`;
    using held = new HeldOpenFixture(file);
    using flushes = new SyncFlushFixture(() => String(statSync(log).size));
    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]);
    const logged = String(statSync(log).size);

    flushes.failOnce("EIO");
    const refused = Assert.throws(() => database.read("INSERT INTO notes (title) VALUES (?) RETURNING id", "Never run"), Error);
    const written = database.read("INSERT INTO notes (title) VALUES (?) RETURNING id", "Through read");
    database.readAll("INSERT INTO notes (title) VALUES (?) RETURNING id", "Through readAll");

    Assert.areEqual("EIO: failed by the test", refused.message);
    Assert.isTrue(statSync(log).size > Number(logged));
    Assert.areEqual("1", String(written?.["id"]));
    Assert.areEqual("Through read,Through readAll", database.readAll("SELECT title FROM notes ORDER BY id").map(t => t["title"]).join(","));
    Assert.areEqual(`${logged},${logged}`, flushes.flushes.join(","));
    Assert.areEqual(0, held.settled);
  }

  @TestMethod
  public async saysWhenItCouldNotFlushANewDatabaseAndFlushesItOnTheFirstWrite(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    const output = new TextOutputFixture();
    using held = new HeldOpenFixture(file);
    using flushes = new SyncFlushFixture(() => "flushed");
    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES], MigratedDatabaseTests.MOMENT, output);

    held.fail("EIO");
    Assert.isTrue(await WaitFixture.untilAsync(() => output.text.length > 0, MigratedDatabaseTests.WAIT_LIMIT_MILLISECONDS));
    database.run("INSERT INTO notes (title) VALUES (?)", "Flushed first");

    Assert.areEqual(`The runtime could not flush the new database ${file} to disk in the background, so its first write flushes it: Error: EIO: held by the test\n`, output.text);
    Assert.areEqual("flushed", flushes.flushes.join(","));
  }

  @TestMethod
  public async staysQuietWhenTheDatabaseClosesWhileItsLogIsAboutToBeFlushed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    const output = new TextOutputFixture();
    using held = new HeldOpenFixture(`${file}-wal`);
    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES], MigratedDatabaseTests.MOMENT, output);
    Assert.isTrue(await WaitFixture.untilAsync(() => held.held.length === 1, MigratedDatabaseTests.WAIT_LIMIT_MILLISECONDS));

    database.close();
    held.release();
    Assert.isTrue(await WaitFixture.untilAsync(() => held.settled === 1, MigratedDatabaseTests.WAIT_LIMIT_MILLISECONDS));
    await new Promise(resolve => setImmediate(resolve));

    Assert.isFalse(existsSync(`${file}-wal`));
    Assert.areEqual(String.empty, output.text);
  }

  @TestMethod
  public async opensAZeroedFileWithItsDataWhenSqliteReadsItWithItsLog(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    const [contents, log] = await MigratedDatabaseTests.writeLoggedDatabaseAsync();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.alloc(contents.length));
    await writeFile(`${file}-wal`, log);
    const output = new TextOutputFixture();

    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES], MigratedDatabaseTests.MOMENT, output);

    Assert.areEqual("Kept in the log", database.readAll("SELECT title FROM notes").map(t => t["title"]).join(","));
    Assert.isFalse((await readdir(path.dirname(file))).some(t => t.includes("unreadable")));
    Assert.areEqual(String.empty, output.text);
  }

  @TestMethod
  public async movesAnEmptyFileAsideWithItsLogAndCreatesTheDatabaseAnew(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    const [, log] = await MigratedDatabaseTests.writeLoggedDatabaseAsync();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, String.empty);
    await writeFile(`${file}-wal`, log);
    const output = new TextOutputFixture();

    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES], MigratedDatabaseTests.MOMENT, output);

    const kept = `${file}-unreadable-20261002T080910Z`;
    Assert.areEqual(0, database.readAll("SELECT title FROM notes").length);
    Assert.areEqual("notes.sqlite,notes.sqlite-wal", (await readdir(kept)).sort().join(","));
    Assert.areEqual(0, (await readFile(path.join(kept, "notes.sqlite"))).length);
    Assert.isTrue(log.equals(await readFile(path.join(kept, "notes.sqlite-wal"))));
    Assert.areEqual(`The database ${file} had no first page SQLite could read, so the runtime moved it, with its log if it had one, to ${kept} and created it anew.\n`, output.text);
  }

  @TestMethod
  public async failsWhenAFileCannotBeMovedAsideForAnotherReason(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, String.empty);
    await writeFile(`${file}-wal`, "no write-ahead log");
    using held = new HeldRenameFixture(path.join(`${file}-unreadable-20261002T080910Z`, "notes.sqlite-wal"), ["EIO"]);

    const error = await Assert.throwsAsync(
      () => ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES], MigratedDatabaseTests.MOMENT, new TextOutputFixture()), Error);

    Assert.areEqual("EIO", ErrorCodeFixture.of(error));
    Assert.areEqual(1, held.attempts);
  }

  @TestMethod
  public async failsWhenTheFileCannotBeMeasuredForAnotherReason(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    const failure = new RangeError("The file cannot be measured.");
    using _stat = new FailedStatFixture(file, failure);

    const error = await Assert.throwsAsync(
      () => ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES], MigratedDatabaseTests.MOMENT, new TextOutputFixture()), RangeError);

    Assert.areEqual(failure, error);
    Assert.isFalse(existsSync(file));
  }

  @TestMethod
  public async movesAZeroedFileAsideWithALogSqliteCannotReadButOpensAnEmptyFileWhereItIs(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    const empty = directory.locateModuleDatabase("drafts");
    await mkdir(path.dirname(file), { recursive: true });
    await mkdir(path.dirname(empty), { recursive: true });
    await writeFile(file, Buffer.alloc(4_096));
    await writeFile(`${file}-wal`, "no write-ahead log");
    await writeFile(empty, String.empty);
    const output = new TextOutputFixture();

    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES], MigratedDatabaseTests.MOMENT, output);
    using drafts = await ModuleDatabase.openAsync(directory, "drafts", [ModuleDatabaseFixture.NOTES], MigratedDatabaseTests.MOMENT, output);

    const kept = `${file}-unreadable-20261002T080910Z`;
    Assert.areEqual("create-notes", database.appliedMigrations.join(","));
    Assert.areEqual("create-notes", drafts.appliedMigrations.join(","));
    Assert.isTrue((await readdir(kept)).includes("notes.sqlite-wal"));
    Assert.areEqual(4_096, (await readFile(path.join(kept, "notes.sqlite"))).filter(t => t === 0).length);
    Assert.areEqual("no write-ahead log", await readFile(path.join(kept, "notes.sqlite-wal"), "utf8"));
    Assert.isFalse((await readdir(path.dirname(empty))).some(t => t.includes("unreadable")));
    Assert.areEqual(`The database ${file} had no first page SQLite could read, so the runtime moved it, with its log if it had one, to ${kept} and created it anew.\n`, output.text);
  }

  @TestMethod
  public async refusesADamagedOrLargeFileAndLeavesItWhereItIs(): Promise<void> {
    const damaged = [
      Buffer.concat([Buffer.from("SQLite format 3\u0000"), Buffer.alloc(4_080, 0xff)]),
      Buffer.from("not a database"),
      Buffer.alloc(65_537)
    ];
    for (const contents of damaged) {
      await using folder = await TemporaryFolderFixture.createAsync();
      const directory = new DataDirectory(folder.path);
      const file = directory.locateModuleDatabase("notes");
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, contents);

      await Assert.throwsAsync(() => ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]), Error);

      Assert.isTrue(contents.equals(await readFile(file)));
      Assert.isFalse((await readdir(path.dirname(file))).some(t => t.includes("unreadable")));
    }
  }

  @TestMethod
  public async commitsATransactionAndRollsItBackWhenItsActionThrows(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using database = await ModuleDatabase.openAsync(new DataDirectory(folder.path), "notes", [ModuleDatabaseFixture.NOTES]);

    const count = database.transaction(() => {
      database.run("INSERT INTO notes (title) VALUES (?)", "First");
      database.run("INSERT INTO notes (title) VALUES (?)", "Second");
      return database.readAll("SELECT id FROM notes").length;
    });
    const failure = Assert.throws(() => database.transaction(() => {
      database.run("INSERT INTO notes (title) VALUES (?)", "Third");
      throw new RangeError("stop");
    }), RangeError);

    Assert.areEqual(2, count);
    Assert.areEqual("stop", failure.message);
    Assert.areEqual("First,Second", database.readAll("SELECT title FROM notes ORDER BY id").map(t => t["title"]).join(","));
  }

  @TestMethod
  public async refusesATransactionWhoseActionReturnsAThenableAndCommitsNothing(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using database = await ModuleDatabase.openAsync(new DataDirectory(folder.path), "notes", [ModuleDatabaseFixture.NOTES]);
    const sneaky = (): unknown => {
      database.run("INSERT INTO notes (title) VALUES (?)", "Too early");
      return { then: (): void => undefined };
    };

    const failure = Assert.throws(() => database.transaction(sneaky), ArgumentException);

    Assert.isTrue(failure.message.startsWith("A transaction's action must finish before it returns"));
    Assert.areEqual(0, database.readAll("SELECT title FROM notes").length);
    database.transaction(() => database.run("INSERT INTO notes (title) VALUES (?)", "After"));
    Assert.areEqual(1, database.readAll("SELECT title FROM notes").length);
  }

  private static async writeLoggedDatabaseAsync(): Promise<[Buffer, Buffer]> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    const file = directory.locateModuleDatabase("notes");
    using database = await ModuleDatabase.openAsync(directory, "notes", [ModuleDatabaseFixture.NOTES]);
    database.run("INSERT INTO notes (title) VALUES (?)", "Kept in the log");
    return [await readFile(file), await readFile(`${file}-wal`)];
  }
}
