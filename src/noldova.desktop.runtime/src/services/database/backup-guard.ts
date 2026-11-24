/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import "@noldova/context.core";

import { FolderCreation } from "../files/folder-creation.js";
import { Resources } from "../../resources.js";

export class BackupGuard implements Disposable {
  private connection: DatabaseSync | null;

  private constructor(connection: DatabaseSync) {
    this.connection = connection;
  }

  public static async holdAsync(folder: string, waitMilliseconds: number = Resources.backupGuardWaitMilliseconds): Promise<BackupGuard> {
    const connection = await BackupGuard.openAsync(folder, waitMilliseconds);
    try {
      connection.exec(Resources.beginStatement);
      connection.prepare(Resources.readSchemaStatement).get();
    }
    catch (error) {
      connection.close();
      throw error;
    }
    return new BackupGuard(connection);
  }

  public static async holdAloneAsync(folder: string, waitMilliseconds: number = Resources.backupSweepWaitMilliseconds): Promise<BackupGuard | null> {
    const connection = await BackupGuard.openAsync(folder, waitMilliseconds);
    try {
      connection.exec(Resources.acquireOwnershipStatement);
    }
    catch (error) {
      connection.close();
      if (BackupGuard.isBusy(error))
        return null;
      throw error;
    }
    return new BackupGuard(connection);
  }

  public get isHeld(): boolean {
    return !Object.isNull(this.connection);
  }

  public release(): void {
    if (Object.isNull(this.connection))
      return;

    this.connection.exec(Resources.rollbackStatement);
    this.connection.close();
    this.connection = null;
  }

  public [Symbol.dispose](): void {
    this.release();
  }

  private static async openAsync(folder: string, timeout: number): Promise<DatabaseSync> {
    await FolderCreation.createAsync(folder);
    return new DatabaseSync(path.join(folder, Resources.backupGuardFileName), { timeout });
  }

  private static isBusy(error: unknown): boolean {
    return Object.isObject(error) && Resources.errorCodeField in error && error[Resources.errorCodeField] === Resources.busyErrorCode;
  }
}
