/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BackupVerificationException, DataDirectory, UpdateBackup } from "@noldova/desktop.runtime";

import { CorruptDatabaseFixture } from "../../fixtures/corrupt-database.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class UpdateBackupTests {
  private static readonly MOMENT: Date = new Date("2026-10-19T12:00:00.123Z");

  @TestMethod
  public async backsUpTheShellAndEachModuleDatabaseNextToTheMigrationBackups(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    UpdateBackupTests.write(directory.shellDatabase, "shell");
    for (const id of ["tasks", "notes"]) {
      await mkdir(directory.locateModuleFolder(id), { recursive: true });
      UpdateBackupTests.write(directory.locateModuleDatabase(id), id);
    }
    await mkdir(directory.locateModuleFolder("empty"));
    await writeFile(path.join(directory.modulesFolder, "notes.sqlite"), "not a module folder");
    await mkdir(directory.backupsFolder);
    const kept = "notes-before-migration-2-20261002T080910Z.sqlite";
    await writeFile(path.join(directory.backupsFolder, kept), "kept");
    await writeFile(path.join(directory.backupsFolder, "notes-before-update-20261018T080910Z.sqlite.tmp"), "partial");
    const output = new TextOutputFixture();

    const backups = await UpdateBackup.createAsync(directory, UpdateBackupTests.MOMENT, output);

    const names = ["desktop-before-update-20261019T120000Z.sqlite", "notes-before-update-20261019T120000Z.sqlite", "tasks-before-update-20261019T120000Z.sqlite"];
    Assert.areEqual(names.map(t => path.join(directory.backupsFolder, t)).join(","), backups.join(","));
    Assert.areEqual([".backup-guard", kept, ...names].sort().join(","), (await readdir(directory.backupsFolder)).sort().join(","));
    Assert.areEqual("shell,notes,tasks", backups.map(t => UpdateBackupTests.read(t)).join(","));
    Assert.areEqual("shell,notes,tasks", [directory.shellDatabase, directory.locateModuleDatabase("notes"), directory.locateModuleDatabase("tasks")].map(t => UpdateBackupTests.read(t)).join(","));
    Assert.areEqual(String.empty, output.text);
  }

  @TestMethod
  public async keepsTheNewestThreeUpdateBackupsOfEachDatabaseAndGoesOnPastOneItCannotRemove(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    UpdateBackupTests.write(directory.shellDatabase, "shell");
    await mkdir(directory.locateModuleFolder("notes"), { recursive: true });
    UpdateBackupTests.write(directory.locateModuleDatabase("notes"), "notes");
    const stuck = path.join(directory.backupsFolder, "desktop-before-update-20261001T080910Z.sqlite");
    await mkdir(stuck, { recursive: true });
    await writeFile(path.join(stuck, "inside"), "kept");
    const kept = ["desktop-before-update-20261003T080910Z.sqlite", "desktop-before-update-20261004T080910Z.sqlite", "notes-before-update-20261002T080910Z.sqlite", "notes-before-update-20261003T080910Z.sqlite",
      "notes-before-migration-2-20261001T080910Z.sqlite"];
    for (const name of ["desktop-before-update-20261002T080910Z.sqlite", "notes-before-update-20261001T080910Z.sqlite", ...kept])
      await writeFile(path.join(directory.backupsFolder, name), name);
    const output = new TextOutputFixture();

    const backups = await UpdateBackup.createAsync(directory, UpdateBackupTests.MOMENT, output);

    const names = ["desktop-before-update-20261019T120000Z.sqlite", "notes-before-update-20261019T120000Z.sqlite"];
    Assert.areEqual(names.map(t => path.join(directory.backupsFolder, t)).join(","), backups.join(","));
    Assert.areEqual([".backup-guard", path.basename(stuck), ...kept, ...names].sort().join(","), (await readdir(directory.backupsFolder)).sort().join(","));
    Assert.isTrue(output.text.startsWith(`The runtime could not remove the older backup ${stuck}, so it is kept: `), output.text);
  }

  @TestMethod
  public async skipsAModulesFolderWhoseNameIsNoModuleId(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    UpdateBackupTests.write(directory.shellDatabase, "shell");
    const strays = ["Bad_Name", "desktop"].map(t => path.join(directory.modulesFolder, t));
    for (const stray of strays) {
      await mkdir(stray, { recursive: true });
      UpdateBackupTests.write(path.join(stray, `${path.basename(stray)}.sqlite`), "stray");
    }
    const output = new TextOutputFixture();

    const backups = await UpdateBackup.createAsync(directory, UpdateBackupTests.MOMENT, output);

    Assert.areEqual(path.join(directory.backupsFolder, "desktop-before-update-20261019T120000Z.sqlite"), backups.join(","));
    Assert.areEqual("shell", UpdateBackupTests.read(backups[0] ?? String.empty));
    Assert.areEqual(strays.map(t => `The update backup skipped ${t}, since its name is no module's id.\n`).join(String.empty), output.text);
  }

  @TestMethod
  public async failsWhenAModulesDatabaseCannotBeLocatedForAnotherReason(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await mkdir(path.join(directory.modulesFolder, "notes"), { recursive: true });
    const failure = new RangeError("The database cannot be located.");
    Object.assign(directory, { locateModuleDatabase: (): never => {
      throw failure;
    } });
    const output = new TextOutputFixture();

    const error = await Assert.throwsAsync(() => UpdateBackup.createAsync(directory, UpdateBackupTests.MOMENT, output), RangeError);

    Assert.areEqual(failure, error);
    Assert.areEqual(String.empty, output.text);
  }

  @TestMethod
  public async backsUpNothingInADataDirectoryWithoutDatabases(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "gone"));

    const backups = await UpdateBackup.createAsync(directory);

    Assert.areEqual(0, backups.length);
    Assert.isFalse(existsSync(directory.root));
  }

  @TestMethod
  public async stopsAtADatabaseWhoseBackupFailsVerification(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    UpdateBackupTests.write(directory.shellDatabase, "shell");
    for (const id of ["notes", "tasks"])
      await mkdir(directory.locateModuleFolder(id), { recursive: true });
    await CorruptDatabaseFixture.writeAsync(directory.locateModuleDatabase("notes"));
    UpdateBackupTests.write(directory.locateModuleDatabase("tasks"), "tasks");

    await Assert.throwsAsync(() => UpdateBackup.createAsync(directory, UpdateBackupTests.MOMENT), BackupVerificationException);

    Assert.areEqual(".backup-guard,desktop-before-update-20261019T120000Z.sqlite", (await readdir(directory.backupsFolder)).sort().join(","));
  }

  @TestMethod
  public async failsWhenTheModulesFolderCannotBeListed(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await writeFile(directory.modulesFolder, "not a folder");

    const error = await Assert.throwsAsync(() => UpdateBackup.createAsync(directory, UpdateBackupTests.MOMENT, new TextOutputFixture()), Error);

    Assert.isTrue(error.message.startsWith("ENOTDIR"), error.message);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async failsWhenADatabaseCannotBeLookedUp(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await symlink(directory.shellDatabase, directory.shellDatabase);

    const error = await Assert.throwsAsync(() => UpdateBackup.createAsync(directory, UpdateBackupTests.MOMENT, new TextOutputFixture()), Error);

    Assert.isTrue(error.message.startsWith("ELOOP"), error.message);
  }

  private static write(file: string, text: string): void {
    const database = new DatabaseSync(file);
    try {
      database.exec("PRAGMA journal_mode = WAL; CREATE TABLE notes (text TEXT) STRICT;");
      database.prepare("INSERT INTO notes VALUES (?)").run(text);
    }
    finally {
      database.close();
    }
  }

  private static read(file: string): unknown {
    const database = new DatabaseSync(file, { readOnly: true });
    try {
      return database.prepare("SELECT text FROM notes").get()?.["text"];
    }
    finally {
      database.close();
    }
  }
}
