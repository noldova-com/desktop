/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { closeSync, fsyncSync, openSync } from "node:fs";
import { mkdir, open, readFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync, type SQLInputValue, type SQLOutputValue, type StatementResultingChanges } from "node:sqlite";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ArgumentException, ExceptionOptions } from "@noldova/context.exceptions";

import { UnknownSchemaFailure } from "../../enums/unknown-schema-failure.js";
import { MigrationException } from "../../exceptions/migration.exception.js";
import { UnknownSchemaException } from "../../exceptions/unknown-schema.exception.js";
import type { Migration } from "../../models/migration.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import { DatabaseBackup } from "./database-backup.js";

export class MigratedDatabase implements Disposable {
  private static readonly flushes: WeakMap<DatabaseSync, { readonly file: string; isFileFlushed: boolean }> = new WeakMap();

  private readonly connection: DatabaseSync;
  private readonly flush: { readonly file: string; isFileFlushed: boolean } | null;

  public readonly appliedMigrations: readonly string[];

  protected constructor(connection: DatabaseSync, appliedMigrations: readonly string[]) {
    this.connection = connection;
    this.appliedMigrations = [...appliedMigrations];
    this.flush = MigratedDatabase.flushes.get(connection) ?? null;
  }

  public read(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue> | undefined {
    const prepared = this.connection.prepare(statement);
    this.flushNewFile();
    return prepared.get(...values);
  }

  public readAll(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue>[] {
    const prepared = this.connection.prepare(statement);
    this.flushNewFile();
    return prepared.all(...values);
  }

  public run(statement: string, ...values: SQLInputValue[]): StatementResultingChanges {
    const prepared = this.connection.prepare(statement);
    this.flushNewFile();
    return prepared.run(...values);
  }

  public transaction<T>(action: () => T & ([T] extends [PromiseLike<unknown>] ? never : unknown)): T {
    this.connection.exec(Resources.beginMigrationStatement);
    let result: T;
    try {
      result = action();
    }
    catch (error) {
      this.connection.exec(Resources.rollbackStatement);
      throw error;
    }
    if (Object.isObject(result) && Resources.thenProperty in result && Object.isFunction(result[Resources.thenProperty])) {
      this.connection.exec(Resources.rollbackStatement);
      throw new ArgumentException(Resources.transactionNotSynchronous, Resources.actionParameterName);
    }
    this.connection.exec(Resources.commitStatement);
    return result;
  }

  public close(): void {
    if (this.connection.isOpen)
      this.connection.close();
  }

  public [Symbol.dispose](): void {
    this.close();
  }

  protected static async migrateAsync(
    file: string,
    name: string,
    migrations: readonly Migration[],
    backupsFolder: string,
    backupOwner: string,
    moment: Date,
    diagnostics: Writable): Promise<[DatabaseSync, readonly string[]]> {
    await DatabaseBackup.removeLeftoversAsync(backupsFolder, diagnostics);
    const isNew = await MigratedDatabase.prepareFileAsync(file, moment, diagnostics);
    const connection = new DatabaseSync(file);
    try {
      connection.exec(isNew ? Resources.creatingSynchronousStatement : Resources.migratingSynchronousStatement);
      connection.exec(Resources.writeAheadLogStatement);
      const applied = MigratedDatabase.prepareHistory(connection, name, migrations);
      const pending = migrations.slice(applied.length);
      if (applied.length > 0 && pending.length > 0)
        await DatabaseBackup.createAsync(
          connection,
          backupsFolder,
          Resources.formatBackupName(backupOwner, applied.length + 1, Resources.formatTimestamp(moment)),
          Resources.backupGuardWaitMilliseconds,
          Resources.formatBackupSeries(backupOwner),
          diagnostics);
      for (const [index, migration] of pending.entries())
        MigratedDatabase.apply(connection, name, migration, applied.length + index + 1);
      connection.exec(Resources.openSynchronousStatement);
      if (isNew) {
        const flush = { file, isFileFlushed: false };
        MigratedDatabase.flushes.set(connection, flush);
        setImmediate(() => void MigratedDatabase.flushAsync(connection, flush, diagnostics));
      }
      return [connection, migrations.map(t => t.id)];
    }
    catch (error) {
      connection.close();
      throw error;
    }
  }

  private static async prepareFileAsync(file: string, moment: Date, diagnostics: Writable): Promise<boolean> {
    const size = await MigratedDatabase.measureAsync(file);
    const hasLog = await MigratedDatabase.measureAsync(`${file}${Resources.writeAheadLogSuffix}`) > 0;
    if (size === 0 && !hasLog)
      return true;
    if (size > 0 && (size > Resources.newDatabaseLimitBytes || (await readFile(file)).some(t => t !== 0) || (hasLog && MigratedDatabase.isReadable(file))))
      return false;

    const folder = Resources.formatUnreadableFolderName(file, Resources.formatTimestamp(moment));
    await mkdir(folder);
    for (const suffix of Resources.databaseFileSuffixes)
      await rename(`${file}${suffix}`, path.join(folder, `${path.basename(file)}${suffix}`)).catch((error: unknown) => {
        if (!SystemErrorCode.is(error, Resources.missingFileErrorCode))
          throw error;
      });
    diagnostics.write(Resources.formatUnreadableDatabaseMoved(file, folder));
    return true;
  }

  private static measureAsync(file: string): Promise<number> {
    return stat(file).then(t => t.size, (error: unknown) => {
      if (!SystemErrorCode.is(error, Resources.missingFileErrorCode))
        throw error;
      return 0;
    });
  }

  private static isReadable(file: string): boolean {
    try {
      const probe = new DatabaseSync(file, { readOnly: true });
      try {
        probe.prepare(Resources.readTablesStatement).all();
      }
      finally {
        probe.close();
      }
      return true;
    }
    catch (error) {
      SystemErrorCode.expect(error, Resources.sqliteErrorCode);
      return false;
    }
  }

  private static async flushAsync(connection: DatabaseSync, flush: { readonly file: string; isFileFlushed: boolean }, diagnostics: Writable): Promise<void> {
    try {
      await MigratedDatabase.syncAsync(flush.file);
      flush.isFileFlushed = true;
      if (connection.isOpen)
        await MigratedDatabase.syncAsync(`${flush.file}${Resources.writeAheadLogSuffix}`);
    }
    catch (error) {
      if (connection.isOpen)
        diagnostics.write(Resources.formatNewDatabaseNotFlushed(flush.file, String(error)));
    }
  }

  private static async syncAsync(file: string): Promise<void> {
    const handle = await open(file, Resources.flushFileMode);
    try {
      await handle.sync();
    }
    finally {
      await handle.close();
    }
  }

  private flushNewFile(): void {
    if (Object.isNull(this.flush) || this.flush.isFileFlushed)
      return;
    const descriptor = openSync(this.flush.file, Resources.flushFileMode);
    try {
      fsyncSync(descriptor);
    }
    finally {
      closeSync(descriptor);
    }
    this.flush.isFileFlushed = true;
  }

  private static prepareHistory(connection: DatabaseSync, name: string, migrations: readonly Migration[]): readonly string[] {
    const tables = connection.prepare(Resources.readTablesStatement).all().map(t => t[Resources.nameColumn]);
    if (!tables.includes(Resources.historyTableName)) {
      if (tables.length > 0)
        throw new UnknownSchemaException(UnknownSchemaFailure.TablesWithoutHistory, name);
      connection.exec(Resources.createHistoryStatement);
      return [];
    }

    const history = connection.prepare(Resources.readHistoryStatement).all();
    if (history.length > migrations.length)
      throw new UnknownSchemaException(UnknownSchemaFailure.HistoryNewer, name);
    const known = migrations.map(t => t.id);
    if (!history.every((t, index) => t[Resources.positionColumn] === index + 1 && t[Resources.idColumn] === known[index]))
      throw new UnknownSchemaException(UnknownSchemaFailure.HistoryNotRecognized, name);
    return known.slice(0, history.length);
  }

  private static apply(connection: DatabaseSync, name: string, migration: Migration, position: number): void {
    connection.exec(Resources.beginMigrationStatement);
    try {
      for (const statement of migration.statements)
        connection.exec(statement);
      connection.prepare(Resources.insertHistoryStatement).run(position, migration.id);
      connection.exec(Resources.commitStatement);
    }
    catch (error) {
      connection.exec(Resources.rollbackStatement);
      throw new MigrationException(name, migration.id, new ExceptionOptions(error));
    }
  }
}
