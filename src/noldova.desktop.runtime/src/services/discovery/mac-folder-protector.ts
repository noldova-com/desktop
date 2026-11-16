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

import { AddonIncompleteException } from "../../exceptions/addon-incomplete.exception.js";
import { FolderNotPrivateException } from "../../exceptions/folder-not-private.exception.js";
import type { IFolderProtector } from "../../interfaces/i-folder-protector.js";
import type { IPosixProcessAddon } from "../../interfaces/i-posix-process-addon.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";
import type { NativeAddon } from "../native/native-addon.js";

export class MacFolderProtector implements IFolderProtector {
  private readonly command: SystemCommand;
  private readonly addon: NativeAddon<IPosixProcessAddon>;
  private readonly user: string;

  public constructor(command: SystemCommand, addon: NativeAddon<IPosixProcessAddon>, user: string = userInfo().username) {
    this.command = command;
    this.addon = addon;
    this.user = user;
  }

  private static isVolume(value: unknown): value is readonly [string, boolean] {
    return Array.isArray(value) && value.length === 2 && Object.isString(value[0]) && Object.isBoolean(value[1]);
  }

  public async protectAsync(folder: string): Promise<void> {
    const addon = this.addon.load();
    if (Object.isUndefined(addon.readVolume))
      throw new AddonIncompleteException(this.addon.name);
    const [volume, isOwnershipIgnored] = this.addon.expect(addon.readVolume(folder), MacFolderProtector.isVolume);
    if (isOwnershipIgnored)
      throw new FolderNotPrivateException(folder, Resources.formatOwnershipIgnored(volume));
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
