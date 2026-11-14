/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { link, mkdir, open, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import type { Writable } from "node:stream";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { BackupVerificationException } from "../../exceptions/backup-verification.exception.js";
import { Resources } from "../../resources.js";
import { FilePresence } from "../files/file-presence.js";
import { BackupGuard } from "./backup-guard.js";

export class DatabaseBackup {
  public static async createAsync(
    source: DatabaseSync,
    folder: string,
    name: string,
    waitMilliseconds: number = Resources.backupGuardWaitMilliseconds,
    series: string | null = null,
    diagnostics: Writable = process.stderr): Promise<string> {
    await mkdir(folder, { recursive: true });
    const guard = await BackupGuard.holdAsync(folder, waitMilliseconds);
    try {
      const target = await DatabaseBackup.copyAsync(source, path.join(folder, name));
      if (!Object.isNull(series))
        await DatabaseBackup.removeOlderAsync(folder, name, series, diagnostics);
      return target;
    }
    finally {
      guard.release();
    }
  }

  public static async removeLeftoversAsync(
    folder: string,
    diagnostics: Writable = process.stderr,
    waitMilliseconds: number = Resources.backupSweepWaitMilliseconds): Promise<readonly string[]> {
    let guard: BackupGuard | null = null;
    try {
      if (!await FilePresence.existsAsync(folder))
        return [];
      guard = await BackupGuard.holdAloneAsync(folder, waitMilliseconds);
      return Object.isNull(guard) ? [] : await DatabaseBackup.removeEachAsync(folder, await readdir(folder), diagnostics);
    }
    catch (error) {
      diagnostics.write(Resources.formatLeftoversNotChecked(folder, String(error)));
      return [];
    }
    finally {
      guard?.release();
    }
  }

  public static verify(file: string): void {
    let results: unknown[];
    try {
      const check = new DatabaseSync(file, { readOnly: true });
      try {
        results = check.prepare(Resources.integrityCheckStatement).all().map(t => t[Resources.integrityCheckColumn]);
      }
      finally {
        check.close();
      }
    }
    catch (error) {
      throw new BackupVerificationException(new ExceptionOptions(error));
    }
    if (results.length !== 1 || results[0] !== Resources.integrityOk)
      throw new BackupVerificationException();
  }

  private static async removeEachAsync(folder: string, names: readonly string[], diagnostics: Writable): Promise<readonly string[]> {
    const removed: string[] = [];
    for (const name of names.filter(t => Resources.databaseFileSuffixes.some(u => t.endsWith(`${Resources.backupExtension}${Resources.temporarySuffix}${u}`))).sort())
      try {
        await rm(path.join(folder, name), { force: true });
        removed.push(name);
      }
      catch (error) {
        diagnostics.write(Resources.formatLeftoverNotRemoved(path.join(folder, name), String(error)));
      }
    return removed;
  }

  private static async removeOlderAsync(folder: string, kept: string, series: string, diagnostics: Writable): Promise<void> {
    let names: string[];
    try {
      names = await readdir(folder);
    }
    catch (error) {
      diagnostics.write(Resources.formatOlderBackupsNotChecked(folder, String(error)));
      return;
    }
    const stamp = (t: string): string | undefined => t.startsWith(series) ? Resources.backupTailPattern.exec(t.slice(series.length))?.[1] : undefined;
    const newest = stamp(kept);
    const older = names.flatMap(t => {
      const timestamp = stamp(t);
      return Object.isUndefined(timestamp) || Object.isUndefined(newest) || timestamp >= newest ? [] : [`${timestamp}${Resources.folderSeparator}${t}`];
    });
    for (const name of older.sort().reverse().slice(Resources.keptBackupCount - 1).map(t => t.slice(t.indexOf(Resources.folderSeparator) + 1)))
      try {
        for (const suffix of [...Resources.databaseFileSuffixes].reverse())
          await rm(path.join(folder, `${name}${suffix}`), { force: true });
      }
      catch (error) {
        diagnostics.write(Resources.formatOlderBackupNotRemoved(path.join(folder, name), String(error)));
      }
  }

  private static async copyAsync(source: DatabaseSync, target: string): Promise<string> {
    const temporary = `${target}${Resources.temporarySuffix}`;
    await (await open(temporary, Resources.exclusiveWriteFlag, Resources.privateFileMode)).close();
    try {
      await backup(source, temporary);
      const copy = new DatabaseSync(temporary);
      try {
        copy.exec(Resources.rollbackJournalStatement);
      }
      finally {
        copy.close();
      }
      DatabaseBackup.verify(temporary);
      await link(temporary, target);
      return target;
    }
    finally {
      for (const suffix of Resources.databaseFileSuffixes)
        await rm(`${temporary}${suffix}`, { force: true });
    }
  }
}
