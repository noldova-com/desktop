/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { rmSync } from "node:fs";
import { readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { AppImageCopyRecord } from "../../models/app-image-copy-record.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { FolderCreation } from "../files/folder-creation.js";
import { Resources } from "../../resources.js";
import { AppImageKeepalive } from "../client/app-image-keepalive.js";
import type { DataDirectory } from "../data-directory/data-directory.js";
import type { ProcessPresence } from "../installation/process-presence.js";

export class AppImageCopyCleanup {
  public static async removeAsync(directory: DataDirectory, diagnostics: Writable, presence: ProcessPresence,
    findWriters: (file: string) => readonly number[] = AppImageKeepalive.findWriters): Promise<void> {
    await FolderCreation.createAsync(directory.logsFolder);
    const records = (await readdir(directory.logsFolder)).filter(t => Resources.copyRecordNamePattern.test(t)).map(t => path.join(directory.logsFolder, t));
    await Promise.all(records.map(t => AppImageCopyCleanup.endAsync(t, presence, findWriters).catch((error: unknown) => {
      diagnostics.write(Resources.formatCopyNotEnded(t, String(error)));
    })));
  }

  public static async removeOwnAsync(file: string, diagnostics: Writable): Promise<void> {
    await AppImageCopyCleanup.removeOwnCopyAsync(file).catch((error: unknown) => {
      diagnostics.write(Resources.formatCopyNotEnded(file, String(error)));
    });
  }

  private static async removeOwnCopyAsync(file: string): Promise<void> {
    const record = await AppImageCopyRecord.readAsync(file);
    if (Object.isNull(record?.mounter ?? null))
      await AppImageCopyCleanup.removeCopyAsync(file, record);
  }

  private static async endAsync(file: string, presence: ProcessPresence, findWriters: (file: string) => readonly number[]): Promise<void> {
    const record = await AppImageCopyRecord.readAsync(file);
    if (Object.isNull(record) || await presence.isRunningAsync(record.holder))
      return;
    const listing = `${file}${Resources.copyListingSuffix}`;
    for (const processId of await AppImageCopyCleanup.findMountersAsync(record, listing, presence, findWriters))
      process.kill(processId, Resources.copyEndSignal);
    await rm(listing, { force: true });
    await AppImageCopyCleanup.removeCopyAsync(file, record);
  }

  private static async findMountersAsync(record: AppImageCopyRecord, listing: string, presence: ProcessPresence, findWriters: (file: string) => readonly number[]):
    Promise<readonly number[]> {
    if (!Object.isNull(record.mounter))
      return await presence.isRunningAsync(record.mounter) ? [record.mounter.processId] : [];
    if (!Object.isNull(record.extraction))
      return [];
    const file = await realpath(listing).catch((error: unknown) => {
      if (!SystemErrorCode.is(error, Resources.missingFileErrorCode))
        throw error;
      return null;
    });
    return Object.isNull(file) ? [] : findWriters(file);
  }

  private static async removeCopyAsync(file: string, record: AppImageCopyRecord | null): Promise<void> {
    if (Object.isNull(record) || Object.isNull(record.extraction) || AppImageCopyCleanup.removeExtraction(record.extraction))
      await rm(file, { force: true });
  }

  private static removeExtraction(folder: string): boolean {
    const location = path.resolve(folder);
    if (path.dirname(location) !== path.resolve(tmpdir()))
      return false;
    if (!Resources.copyExtractionName.test(path.basename(location)))
      return true;
    const isArchiveOff = process.noAsar;
    process.noAsar = true;
    try {
      rmSync(location, { recursive: true, force: true });
    }
    finally {
      process.noAsar = isArchiveOff;
    }
    return true;
  }
}
