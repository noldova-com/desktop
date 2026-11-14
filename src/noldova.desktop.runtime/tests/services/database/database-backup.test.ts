/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BackupGuard, BackupVerificationException, DatabaseBackup } from "@noldova/desktop.runtime";

import { BackupHolderFixture } from "../../fixtures/backup-holder.fixture.js";
import { CorruptDatabaseFixture } from "../../fixtures/corrupt-database.fixture.js";
import { FileSystemPatchFixture } from "../../fixtures/file-system-patch.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class DatabaseBackupTests {
  private static readonly REFUSAL_WAIT: number = 5;

  @TestMethod
  public async copiesCommittedWriteAheadLogDataIntoAVerifiedOwnerOnlyBackup(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const backups = path.join(folder.path, "backups");
    const source = new DatabaseSync(path.join(folder.path, "source.sqlite"));
    let file: string;
    try {
      source.exec("PRAGMA journal_mode = WAL; CREATE TABLE notes (text TEXT) STRICT; INSERT INTO notes VALUES ('only in the log');");

      file = await DatabaseBackup.createAsync(source, backups, "copy.sqlite");
    }
    finally {
      source.close();
    }

    Assert.areEqual(path.join(backups, "copy.sqlite"), file);
    Assert.areEqual(".backup-guard,copy.sqlite", (await readdir(backups)).sort().join(","));
    DatabaseBackup.verify(file);
    const copy = new DatabaseSync(file, { readOnly: true });
    try {
      Assert.areEqual("only in the log", copy.prepare("SELECT text FROM notes").get()?.["text"]);
    }
    finally {
      copy.close();
    }
    if (process.platform !== "win32")
      Assert.areEqual(0o600, (await stat(file)).mode & 0o777);
  }

  @TestMethod
  public async neverOverwritesAnExistingBackup(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const source = new DatabaseSync(path.join(folder.path, "source.sqlite"));
    try {
      await DatabaseBackup.createAsync(source, folder.path, "copy.sqlite");

      await Assert.throwsAsync(() => DatabaseBackup.createAsync(source, folder.path, "copy.sqlite"), Error);
    }
    finally {
      source.close();
    }
    Assert.areEqual(".backup-guard,copy.sqlite,source.sqlite", (await readdir(folder.path)).sort().join(","));
  }

  @TestMethod
  public async refusesToPublishACopyThatFailsItsIntegrityCheck(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const corrupt = path.join(folder.path, "corrupt.sqlite");
    await CorruptDatabaseFixture.writeAsync(corrupt);
    const source = new DatabaseSync(corrupt);
    try {
      await Assert.throwsAsync(() => DatabaseBackup.createAsync(source, path.join(folder.path, "backups"), "copy.sqlite"), BackupVerificationException);
    }
    finally {
      source.close();
    }

    Assert.areEqual(".backup-guard", (await readdir(path.join(folder.path, "backups"))).join(","));
  }

  @TestMethod
  public async keepsTheNewestThreeBackupsOfItsSeriesOnceTheNewOneIsPublished(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const removed = ["notes-before-update-20261001T080910Z.sqlite", "notes-before-update-20261001T080910Z.sqlite-journal", "notes-before-update-20261002T080910Z.sqlite"];
    const kept = ["notes-before-update-20261003T080910Z.sqlite", "notes-before-update-20261004T080910Z.sqlite", "notes-before-migration-2-20261001T080910Z.sqlite",
      "tasks-before-update-20261001T080910Z.sqlite", "notes-before-update-before-update-20261001T080910Z.sqlite", "notes-before-update-20261001T080910Z.sqlite.tmp",
      "notes-before-update-latest.sqlite"];
    await DatabaseBackupTests.writeAllAsync(folder.path, [...removed, ...kept]);
    const output = new TextOutputFixture();

    const backup = await DatabaseBackupTests.backUpAsync(folder.path, "notes-before-update-20261019T120000Z.sqlite", "notes-before-update-", output);

    Assert.areEqual([".backup-guard", path.basename(backup), ...kept].sort().join(","), (await readdir(folder.path)).sort().join(","));
    Assert.areEqual(String.empty, output.text);
  }

  @TestMethod
  public async keepsBackupsDatedAfterTheNewOneAndTheNewestTwoBeforeItByTime(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const older = ["notes-before-migration-9-20261009T080910Z.sqlite", "notes-before-migration-10-20261010T080910Z.sqlite", "notes-before-migration-11-20261011T080910Z.sqlite"];
    const ahead = ["notes-before-migration-2-20271101T080910Z.sqlite", "notes-before-migration-3-20271102T080910Z.sqlite"];
    await DatabaseBackupTests.writeAllAsync(folder.path, [...older, ...ahead]);

    const backup = await DatabaseBackupTests.backUpAsync(folder.path, "notes-before-migration-12-20261012T080910Z.sqlite", "notes-before-migration-", new TextOutputFixture());

    Assert.areEqual([".backup-guard", path.basename(backup), ...older.slice(1), ...ahead].sort().join(","), (await readdir(folder.path)).sort().join(","));
  }

  @TestMethod
  public async removesNothingWhenTheNewNameIsOutsideItsSeries(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const older = ["notes-before-update-20261001T080910Z.sqlite", "notes-before-update-20261002T080910Z.sqlite", "notes-before-update-20261003T080910Z.sqlite"];
    await DatabaseBackupTests.writeAllAsync(folder.path, older);

    const backup = await DatabaseBackupTests.backUpAsync(folder.path, "notes-copy.sqlite", "notes-before-update-", new TextOutputFixture());

    Assert.areEqual([".backup-guard", path.basename(backup), ...older].sort().join(","), (await readdir(folder.path)).sort().join(","));
  }

  @TestMethod
  public async removesNoOlderBackupWhenTheNewOneIsNotPublished(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const older = ["notes-before-update-20261001T080910Z.sqlite", "notes-before-update-20261002T080910Z.sqlite", "notes-before-update-20261003T080910Z.sqlite"];
    await DatabaseBackupTests.writeAllAsync(folder.path, older);
    const corrupt = path.join(folder.path, "corrupt.sqlite");
    await CorruptDatabaseFixture.writeAsync(corrupt);
    const source = new DatabaseSync(corrupt);
    try {
      await Assert.throwsAsync(
        () => DatabaseBackup.createAsync(source, folder.path, "notes-before-update-20261019T120000Z.sqlite", 1000, "notes-before-update-", new TextOutputFixture()),
        BackupVerificationException);
    }
    finally {
      source.close();
    }

    Assert.areEqual([".backup-guard", "corrupt.sqlite", ...older].sort().join(","), (await readdir(folder.path)).sort().join(","));
  }

  @TestMethod
  public async keepsAnOlderBackupItCannotRemoveAndSaysSo(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const stuck = path.join(folder.path, "notes-before-update-20261001T080910Z.sqlite");
    await mkdir(stuck);
    await writeFile(path.join(stuck, "inside"), "kept");
    const whole = path.join(folder.path, "notes-before-update-20260930T080910Z.sqlite");
    await mkdir(`${whole}-wal`);
    await writeFile(path.join(`${whole}-wal`, "inside"), "kept");
    const removed = "notes-before-update-20261002T080910Z.sqlite";
    const kept = ["notes-before-update-20261003T080910Z.sqlite", "notes-before-update-20261004T080910Z.sqlite"];
    await DatabaseBackupTests.writeAllAsync(folder.path, [path.basename(whole), `${path.basename(whole)}-journal`, removed, ...kept]);
    const output = new TextOutputFixture();

    const backup = await DatabaseBackupTests.backUpAsync(folder.path, "notes-before-update-20261019T120000Z.sqlite", "notes-before-update-", output);

    const left = [path.basename(stuck), path.basename(whole), `${path.basename(whole)}-wal`, ...kept];
    Assert.areEqual([".backup-guard", path.basename(backup), ...left].sort().join(","), (await readdir(folder.path)).sort().join(","));
    Assert.isTrue(output.text.startsWith(`The runtime could not remove the older backup ${stuck}, so it is kept: `), output.text);
    Assert.isTrue(output.text.includes(`The runtime could not remove the older backup ${whole}, so it is kept: `), output.text);
  }

  @TestMethod
  public async keepsTheOlderBackupsWhenItCannotListThemAndSaysSo(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const older = ["notes-before-update-20261001T080910Z.sqlite", "notes-before-update-20261002T080910Z.sqlite", "notes-before-update-20261003T080910Z.sqlite"];
    await DatabaseBackupTests.writeAllAsync(folder.path, older);
    const output = new TextOutputFixture();

    {
      using _fileSystem = new FileSystemPatchFixture(folder.path);
      await DatabaseBackupTests.backUpAsync(folder.path, "notes-before-update-20261019T120000Z.sqlite", "notes-before-update-", output);
    }

    Assert.areEqual([".backup-guard", "notes-before-update-20261019T120000Z.sqlite", ...older].sort().join(","), (await readdir(folder.path)).sort().join(","));
    Assert.areEqual(`The runtime could not check ${folder.path} for older backups, so it kept them: Error: EACCES: permission denied, access '${folder.path}'\n`, output.text);
  }

  @TestMethod
  public async removesTheLeftoversOfAnInterruptedBackupAndNothingElse(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const kept = ["notes-before-migration-2-20261002T080910Z.sqlite", "notes.tmp", "notes.sqlite.tmp-old"];
    const leftovers = ["notes-before-migration-3-20261003T080910Z.sqlite.tmp", "notes-before-migration-3-20261003T080910Z.sqlite.tmp-journal",
      "notes-before-migration-3-20261003T080910Z.sqlite.tmp-shm", "notes-before-migration-3-20261003T080910Z.sqlite.tmp-wal"];
    for (const name of [...kept, ...leftovers])
      await writeFile(path.join(folder.path, name), "partial");

    const output = new TextOutputFixture();

    const removed = await DatabaseBackup.removeLeftoversAsync(folder.path, output);

    Assert.areEqual(leftovers.join(","), removed.join(","));
    Assert.areEqual([".backup-guard", ...kept].sort().join(","), (await readdir(folder.path)).sort().join(","));
    Assert.areEqual(0, (await DatabaseBackup.removeLeftoversAsync(path.join(folder.path, "missing"))).length);
    Assert.areEqual(String.empty, output.text);
  }

  @TestMethod
  public async keepsTheLeftoversWhileABackupInThisOrAnotherProcessIsRunning(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const leftover = path.join(folder.path, "notes-before-migration-2-20261002T080910Z.sqlite.tmp");
    await writeFile(leftover, "partial");
    const output = new TextOutputFixture();
    const local = await BackupGuard.holdAsync(folder.path);
    const keptHere = await DatabaseBackup.removeLeftoversAsync(folder.path, output, DatabaseBackupTests.REFUSAL_WAIT);
    local.release();
    await using holder = await BackupHolderFixture.startAsync(folder.path);
    Assert.isTrue(holder.isHeld);

    const keptThere = await DatabaseBackup.removeLeftoversAsync(folder.path, output, DatabaseBackupTests.REFUSAL_WAIT);
    await holder.killAsync();
    const removed = await DatabaseBackup.removeLeftoversAsync(folder.path, output);

    Assert.areEqual(0, keptHere.length);
    Assert.areEqual(0, keptThere.length);
    Assert.areEqual(path.basename(leftover), removed.join(","));
    Assert.isFalse(existsSync(leftover));
    Assert.areEqual(String.empty, output.text);
  }

  @TestMethod
  public async startsNoBackupWhileItsFolderIsBeingSwept(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const source = new DatabaseSync(path.join(folder.path, "source.sqlite"));
    const sweeping = await BackupGuard.holdAloneAsync(folder.path);
    try {
      Assert.isTrue(sweeping?.isHeld ?? false);

      await Assert.throwsAsync(() => DatabaseBackup.createAsync(source, folder.path, "copy.sqlite", DatabaseBackupTests.REFUSAL_WAIT), Error);
    }
    finally {
      sweeping?.release();
      source.close();
    }

    Assert.areEqual(".backup-guard,source.sqlite", (await readdir(folder.path)).sort().join(","));
  }

  @TestMethod
  public async leavesTheLeftoversAndSaysSoWhenItsGuardIsNoDatabase(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const leftover = path.join(folder.path, "notes-before-migration-2-20261002T080910Z.sqlite.tmp");
    await writeFile(leftover, "partial");
    await writeFile(path.join(folder.path, ".backup-guard"), "This is plain text, not a SQLite database, and it is long enough to have a header.");
    const output = new TextOutputFixture();

    const removed = await DatabaseBackup.removeLeftoversAsync(folder.path, output);

    Assert.areEqual(0, removed.length);
    Assert.isTrue(existsSync(leftover));
    Assert.isTrue(output.text.startsWith(`The runtime could not check ${folder.path} for an interrupted backup's files, so it left them: `));
    Assert.isTrue(output.text.endsWith("\n"));
  }

  @TestMethod
  public async leavesALeftoverItCannotRemoveAndRemovesTheRest(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const stuck = path.join(folder.path, "notes-before-migration-2-20261002T080910Z.sqlite.tmp");
    await mkdir(stuck);
    await writeFile(path.join(stuck, "inside"), "partial");
    await writeFile(`${stuck}-wal`, "partial");
    const output = new TextOutputFixture();

    const removed = await DatabaseBackup.removeLeftoversAsync(folder.path, output);

    Assert.areEqual(`${path.basename(stuck)}-wal`, removed.join(","));
    Assert.isTrue(existsSync(path.join(stuck, "inside")));
    Assert.isFalse(existsSync(`${stuck}-wal`));
    Assert.isTrue(output.text.startsWith(`The runtime could not remove the interrupted backup's file ${stuck}, so it is left: `));
  }

  @TestMethod
  public async findsAFileThatIsNoDatabaseUnverified(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "text.sqlite");
    await writeFile(file, "This is plain text, not a SQLite database, and it is long enough to have a header.");

    const exception = Assert.throws(() => DatabaseBackup.verify(file), BackupVerificationException);

    Assert.isInstanceOf(exception.cause, Error);
    Assert.areEqual("The database backup did not pass its integrity check.", exception.message);
  }

  private static async backUpAsync(folder: string, name: string, series: string, output: TextOutputFixture): Promise<string> {
    const source = new DatabaseSync(":memory:");
    try {
      return await DatabaseBackup.createAsync(source, folder, name, 1000, series, output);
    }
    finally {
      source.close();
    }
  }

  private static async writeAllAsync(folder: string, names: readonly string[]): Promise<void> {
    for (const name of names)
      await writeFile(path.join(folder, name), name);
  }
}
