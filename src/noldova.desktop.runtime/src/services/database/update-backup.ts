/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";

import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import { FilePresence } from "../files/file-presence.js";
import { DatabaseBackup } from "./database-backup.js";

export class UpdateBackup {
  public static async createAsync(directory: DataDirectory, moment: Date = new Date(), diagnostics: Writable = process.stderr): Promise<readonly string[]> {
    await DatabaseBackup.removeLeftoversAsync(directory.backupsFolder, diagnostics);
    const timestamp = Resources.formatTimestamp(moment);
    const backups: string[] = [];
    for (const [owner, file] of await UpdateBackup.listDatabasesAsync(directory, diagnostics)) {
      const source = new DatabaseSync(file, { readOnly: true });
      try {
        backups.push(await DatabaseBackup.createAsync(
          source,
          directory.backupsFolder,
          Resources.formatUpdateBackupName(owner, timestamp),
          Resources.backupGuardWaitMilliseconds,
          Resources.formatUpdateBackupSeries(owner),
          diagnostics));
      }
      finally {
        source.close();
      }
    }
    return backups;
  }

  private static async listDatabasesAsync(directory: DataDirectory, diagnostics: Writable): Promise<readonly (readonly [string, string])[]> {
    const modules = (await FilePresence.unlessMissingAsync(readdir(directory.modulesFolder, { withFileTypes: true })) ?? []).filter(t => t.isDirectory()).map(t => t.name).sort();
    const databases = [
      [Resources.reservedModuleId, directory.shellDatabase] as const,
      ...modules.flatMap(t => UpdateBackup.locateModuleDatabase(directory, t, diagnostics))
    ];
    const found: (readonly [string, string])[] = [];
    for (const database of databases) {
      if (await FilePresence.existsAsync(database[1]))
        found.push(database);
    }
    return found;
  }

  private static locateModuleDatabase(directory: DataDirectory, id: string, diagnostics: Writable): readonly (readonly [string, string])[] {
    try {
      return [[id, directory.locateModuleDatabase(id)]];
    }
    catch (error) {
      if (!(error instanceof ArgumentException))
        throw error;
      diagnostics.write(Resources.formatModuleFolderSkipped(path.join(directory.modulesFolder, id)));
      return [];
    }
  }
}
