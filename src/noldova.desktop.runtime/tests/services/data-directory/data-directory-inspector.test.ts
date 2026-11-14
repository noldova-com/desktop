/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  DataDirectory,
  DataDirectoryInspector,
  DataDirectoryState,
  OwnershipLock,
  OwnershipReleasedException
} from "@noldova/desktop.runtime";

import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class DataDirectoryInspectorTests {
  private static readonly MOMENT: Date = new Date("2026-10-01T12:34:56.789Z");
  private static readonly SHELL_BACKUPS: readonly string[] = [
    ".backup-guard",
    ".backup-guard-journal",
    "desktop-before-update-20261001T120000Z.sqlite",
    "desktop-before-update-20261001T120000Z.sqlite-wal",
    "desktop-before-migration-3-20261001T120000Z.sqlite-shm",
    "notes-app-before-migration-1-20261001T120000Z.sqlite",
    "notes-app-before-update-20261002T120000Z.sqlite.tmp-journal"
  ];

  @TestMethod
  public async findsAMissingOrRuntimeOnlyDirectoryEmpty(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "noldova-desktop"));
    const missing = await DataDirectoryInspector.inspectAsync(directory);
    using lock = OwnershipLock.acquire(directory);
    await mkdir(directory.discoveryFolder);
    for (const folder of [directory.backupsFolder, directory.profileFolder, directory.modulesFolder, directory.workFolder, directory.logsFolder])
      await mkdir(folder);
    await writeFile(path.join(directory.logsFolder, "start-0f8b2c1e-6a4d-4e2b-9c3f-1a2b3c4d5e6f.log"), String.empty);
    await writeFile(`${directory.ownershipDatabase}-journal`, String.empty);

    const runtimeOnly = await DataDirectoryInspector.inspectAsync(directory);

    Assert.areEqual(DataDirectoryState.Empty, missing.state);
    Assert.areEqual(DataDirectoryState.Empty, runtimeOnly.state);
    Assert.areEqual(0, runtimeOnly.entries.length);
    Assert.isTrue(lock.isHeld);
  }

  @TestMethod
  public async findsTheShellDatabaseCurrent(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await writeFile(directory.shellDatabase, String.empty);
    await writeFile(`${directory.shellDatabase}-wal`, String.empty);
    await mkdir(directory.modulesFolder);

    const inspection = await DataDirectoryInspector.inspectAsync(directory);

    Assert.areEqual(DataDirectoryState.Current, inspection.state);
    Assert.areEqual("desktop.sqlite,desktop.sqlite-wal", inspection.entries.join(","));
  }

  @TestMethod
  public async findsAnythingElseWithoutTheShellDatabasePreShell(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    await DataDirectoryInspectorTests.writePreShellDataAsync(directory);

    const inspection = await DataDirectoryInspector.inspectAsync(directory);

    Assert.areEqual(DataDirectoryState.PreShell, inspection.state);
    Assert.areEqual(["attachments", "runtime.lock", "runtime.lock.sqlite", "noldova-desktop.db"].sort().join(","), inspection.entries.join(","));
  }

  @TestMethod
  public async movesPreShellDataIntoADatedSiblingAndKeepsTheRuntimeEntries(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "noldova-desktop"));
    using lock = OwnershipLock.acquire(directory);
    await mkdir(directory.discoveryFolder);
    await DataDirectoryInspectorTests.writePreShellDataAsync(directory);

    const destination = await DataDirectoryInspector.moveAsideAsync(lock, DataDirectoryInspectorTests.MOMENT);

    Assert.areEqual(path.join(folder.path, "noldova-desktop-before-shell-20261001T123456Z"), destination);
    Assert.isTrue((await readdir(directory.root)).every(t => ["discovery", "ownership.sqlite", "ownership.sqlite-journal"].includes(t)));
    Assert.areEqual(["attachments", "runtime.lock", "runtime.lock.sqlite", "noldova-desktop.db"].sort().join(","), (await readdir(destination ?? String.empty)).sort().join(","));
    Assert.areEqual("old records", await readFile(path.join(destination ?? String.empty, "noldova-desktop.db"), "utf8"));
    Assert.areEqual(DataDirectoryState.Empty, (await DataDirectoryInspector.inspectAsync(directory)).state);
  }

  @TestMethod
  public async movesTheEarlierEntriesOfTheBackupsFolderWithTheRestAndKeepsTheShellsOwnBackups(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "noldova-desktop"));
    using lock = OwnershipLock.acquire(directory);
    await DataDirectoryInspectorTests.writePreShellDataAsync(directory);
    await mkdir(path.join(directory.backupsFolder, "older"), { recursive: true });
    for (const name of [...DataDirectoryInspectorTests.SHELL_BACKUPS, "chats-2026-09-01.zip", "desktop.sqlite", "older/chats.zip"])
      await writeFile(path.join(directory.backupsFolder, name), name);

    const destination = await DataDirectoryInspector.moveAsideAsync(lock, DataDirectoryInspectorTests.MOMENT) ?? String.empty;

    Assert.areEqual([...DataDirectoryInspectorTests.SHELL_BACKUPS].sort().join(","), (await readdir(directory.backupsFolder)).sort().join(","));
    Assert.areEqual("chats-2026-09-01.zip,desktop.sqlite,older", (await readdir(path.join(destination, "backups"))).sort().join(","));
    Assert.areEqual("older/chats.zip", await readFile(path.join(destination, "backups", "older", "chats.zip"), "utf8"));
    Assert.isTrue(existsSync(path.join(destination, "noldova-desktop.db")));
    Assert.areEqual(DataDirectoryState.Empty, (await DataDirectoryInspector.inspectAsync(directory)).state);
  }

  @TestMethod
  public async findsADirectoryWhoseOnlyEarlierDataIsInItsBackupsPreShellAndMovesABackupsFileWhole(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const inFolder = new DataDirectory(path.join(folder.path, "in-folder"));
    await mkdir(inFolder.backupsFolder, { recursive: true });
    await writeFile(path.join(inFolder.backupsFolder, "chats.zip"), String.empty);
    await writeFile(path.join(inFolder.backupsFolder, "desktop-before-update-20261001T120000Z.sqlite"), String.empty);
    const asFile = new DataDirectory(path.join(folder.path, "as-file"));
    using lock = OwnershipLock.acquire(asFile);
    await writeFile(asFile.backupsFolder, "earlier");

    const inspection = await DataDirectoryInspector.inspectAsync(inFolder);
    const destination = await DataDirectoryInspector.moveAsideAsync(lock, DataDirectoryInspectorTests.MOMENT) ?? String.empty;

    Assert.areEqual(DataDirectoryState.PreShell, inspection.state);
    Assert.areEqual("backups/chats.zip", inspection.entries.join(","));
    Assert.areEqual("earlier", await readFile(path.join(destination, "backups"), "utf8"));
    Assert.isFalse(existsSync(asFile.backupsFolder));
  }

  @TestMethod
  public async movesNothingFromAnEmptyOrCurrentDirectory(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "noldova-desktop"));
    using lock = OwnershipLock.acquire(directory);

    const empty = await DataDirectoryInspector.moveAsideAsync(lock);
    await writeFile(directory.shellDatabase, String.empty);
    const current = await DataDirectoryInspector.moveAsideAsync(lock);

    Assert.isNull(empty);
    Assert.isNull(current);
    Assert.isTrue(existsSync(directory.shellDatabase));
  }

  @TestMethod
  public async neverMovesIntoAnExistingFolder(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(path.join(folder.path, "noldova-desktop"));
    using lock = OwnershipLock.acquire(directory);
    await DataDirectoryInspectorTests.writePreShellDataAsync(directory);
    await mkdir(path.join(folder.path, "noldova-desktop-before-shell-20261001T123456Z"));

    await Assert.throwsAsync(() => DataDirectoryInspector.moveAsideAsync(lock, DataDirectoryInspectorTests.MOMENT), Error);

    Assert.areEqual(DataDirectoryState.PreShell, (await DataDirectoryInspector.inspectAsync(directory)).state);
  }

  @TestMethod
  public async movesOnlyWhileTheOwnershipIsHeld(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const lock = OwnershipLock.acquire(new DataDirectory(folder.path));
    lock.release();

    await Assert.throwsAsync(() => DataDirectoryInspector.moveAsideAsync(lock), OwnershipReleasedException);
  }

  private static async writePreShellDataAsync(directory: DataDirectory): Promise<void> {
    await writeFile(path.join(directory.root, "noldova-desktop.db"), "old records");
    await writeFile(path.join(directory.root, "runtime.lock"), "{}");
    await writeFile(path.join(directory.root, "runtime.lock.sqlite"), String.empty);
    await mkdir(path.join(directory.root, "attachments"));
    await writeFile(path.join(directory.root, "attachments", "image.png"), "image");
  }
}
