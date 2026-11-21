/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { accessSync, constants, createReadStream, realpathSync } from "node:fs";
import { type FileHandle, open, readdir, realpath, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { AppImageFolderUnwritableException } from "../exceptions/app-image-folder-unwritable.exception.js";
import { AppImageLeftoverNotRemovedException } from "../exceptions/app-image-leftover-not-removed.exception.js";
import { AppImageNotReplacedException } from "../exceptions/app-image-not-replaced.exception.js";
import { AppImageUnreadableException } from "../exceptions/app-image-unreadable.exception.js";
import { Resources } from "../resources.js";

export class AppImageReplacement {
  private readonly image: string;
  private readonly log: (text: string) => void;

  public constructor(image: string, log: (text: string) => void) {
    this.image = image;
    this.log = log;
  }

  public get refusal(): string | null {
    let image: string;
    try {
      image = realpathSync(this.image);
    }
    catch (error) {
      return new AppImageUnreadableException(this.image, error).message;
    }
    const folder = path.dirname(image);
    try {
      accessSync(folder, constants.W_OK | constants.X_OK);
      return null;
    }
    catch (error) {
      return new AppImageFolderUnwritableException(folder, error).message;
    }
  }

  public async replaceAsync(download: string): Promise<void> {
    const [image, mode] = await AppImageReplacement.inspectAsync(this.image);
    const folder = path.dirname(image);
    const name = path.basename(image);
    const part = path.join(folder, Resources.formatAppImagePart(name, randomUUID()));
    const handle = await AppImageReplacement.createAsync(part, folder, name, mode);
    try {
      try {
        await handle.chmod(mode);
        await pipeline(createReadStream(download), handle.createWriteStream({ flush: true }));
      }
      finally {
        await handle.close();
      }
      await rename(part, image);
    }
    catch (error) {
      await rm(part, { force: true });
      throw new AppImageNotReplacedException(image, error);
    }
    await AppImageReplacement.syncFolderAsync(folder).catch((error: unknown) => this.log(Resources.formatAppImageFolderNotSynced(folder, String(error))));
  }

  private static async syncFolderAsync(folder: string): Promise<void> {
    const handle = await open(folder, Resources.readFlag);
    return handle.sync().finally(() => handle.close());
  }

  private static async inspectAsync(file: string): Promise<[string, number]> {
    try {
      const image = await realpath(file);
      return [image, (await stat(image)).mode & Resources.permissionBits];
    }
    catch (error) {
      throw new AppImageUnreadableException(file, error);
    }
  }

  private static async createAsync(part: string, folder: string, name: string, mode: number): Promise<FileHandle> {
    await AppImageReplacement.removeLeftoversAsync(folder, name);
    try {
      return await open(part, Resources.createOnlyFlag, mode);
    }
    catch (error) {
      throw new AppImageFolderUnwritableException(folder, error);
    }
  }

  private static async removeLeftoversAsync(folder: string, name: string): Promise<void> {
    try {
      const leftovers = (await readdir(folder, { withFileTypes: true })).filter(t => !t.isDirectory() && Resources.appImagePartPattern.exec(t.name)?.[1] === name);
      for (const leftover of leftovers)
        await rm(path.join(folder, leftover.name), { force: true });
    }
    catch (error) {
      throw new AppImageLeftoverNotRemovedException(folder, new ExceptionOptions(error));
    }
  }
}
