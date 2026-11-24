/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readdir, rename, stat } from "node:fs/promises";
import path from "node:path";

import { DataDirectoryState } from "../../enums/data-directory-state.js";
import { DataDirectoryInspection } from "../../models/data-directory-inspection.js";
import { FolderCreation } from "../files/folder-creation.js";
import { Resources } from "../../resources.js";
import { FilePresence } from "../files/file-presence.js";
import type { OwnershipLock } from "../ownership/ownership-lock.js";
import type { DataDirectory } from "./data-directory.js";

export class DataDirectoryInspector {
  public static async inspectAsync(dataDirectory: DataDirectory): Promise<DataDirectoryInspection> {
    const names = await FilePresence.unlessMissingAsync(readdir(dataDirectory.root));
    const entries = Object.isNull(names)
      ? []
      : [...names.filter(t => !Resources.runtimeEntries.includes(t)), ...await DataDirectoryInspector.listEarlierBackupsAsync(dataDirectory)].sort();
    if (entries.includes(Resources.shellDatabaseFileName))
      return new DataDirectoryInspection(DataDirectoryState.Current, entries);
    return new DataDirectoryInspection(entries.length === 0 ? DataDirectoryState.Empty : DataDirectoryState.PreShell, entries);
  }

  public static async moveAsideAsync(lock: OwnershipLock, moment: Date = new Date()): Promise<string | null> {
    lock.requireHeld();
    const root = lock.dataDirectory.root;
    const inspection = await DataDirectoryInspector.inspectAsync(lock.dataDirectory);
    if (inspection.state !== DataDirectoryState.PreShell)
      return null;

    const destination = Resources.formatMovedFolderName(root, Resources.formatTimestamp(moment));
    await mkdir(destination);
    for (const entry of inspection.entries) {
      const target = path.join(destination, entry);
      await FolderCreation.createAsync(path.dirname(target));
      await rename(path.join(root, entry), target);
    }
    return destination;
  }

  private static async listEarlierBackupsAsync(dataDirectory: DataDirectory): Promise<readonly string[]> {
    const folder = dataDirectory.backupsFolder;
    const stats = await FilePresence.unlessMissingAsync(stat(folder));
    if (Object.isNull(stats))
      return [];
    if (!stats.isDirectory())
      return [Resources.backupsFolderName];
    return (await readdir(folder)).filter(t => !Resources.shellBackupEntryPattern.test(t)).map(t => Resources.formatRelativePath(Resources.backupsFolderName, t));
  }
}
