/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod } from "node:fs/promises";
import { userInfo } from "node:os";

import "@noldova/context.core";

import { FolderNotPrivateException } from "../../exceptions/folder-not-private.exception.js";
import type { IFolderProtector } from "../../interfaces/i-folder-protector.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";

export class MacFolderProtector implements IFolderProtector {
  private readonly command: SystemCommand;
  private readonly user: string;

  public constructor(command: SystemCommand, user: string = userInfo().username) {
    this.command = command;
    this.user = user;
  }

  public async protectAsync(folder: string): Promise<void> {
    await chmod(folder, Resources.privateFolderMode);
    const listing = await this.command.runAsync(Resources.listCommand, [Resources.listAccessArgument, folder]);
    if (!Resources.macPrivateModePattern.test(listing) || !this.isOwnersAlone(listing))
      throw new FolderNotPrivateException(folder, listing.trim());
  }

  private isOwnersAlone(listing: string): boolean {
    const owner = `${Resources.macUserQualifier}${this.user}`;
    const entries = listing.split(Resources.lineBreakPattern).slice(1).filter(t => t.trim().length > 0);
    if (entries.length === 0 && Resources.macAccessListModePattern.test(listing))
      return false;
    return entries.every(t => {
      const entry = Resources.macAccessEntryPattern.exec(t);
      return !Object.isNull(entry) && (entry[2] === Resources.macDenyKind || entry[1] === owner);
    });
  }
}
