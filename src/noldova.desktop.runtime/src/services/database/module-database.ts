/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import type { IModuleDatabase } from "../../interfaces/i-module-database.js";
import type { Migration } from "../../models/migration.js";
import { FolderCreation } from "../files/folder-creation.js";
import { Resources } from "../../resources.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import { MigratedDatabase } from "./migrated-database.js";

export class ModuleDatabase extends MigratedDatabase implements IModuleDatabase {
  public static async openAsync(
    directory: DataDirectory,
    moduleId: string,
    migrations: readonly Migration[],
    moment: Date = new Date(),
    diagnostics: Writable = process.stderr): Promise<ModuleDatabase> {
    const file = directory.locateModuleDatabase(moduleId);
    await FolderCreation.createAsync(path.dirname(file));
    const [connection, applied] = await MigratedDatabase.migrateAsync(
      file,
      Resources.formatModuleDatabaseName(moduleId),
      migrations,
      directory.backupsFolder,
      moduleId,
      moment,
      diagnostics);
    return new ModuleDatabase(connection, applied);
  }
}
