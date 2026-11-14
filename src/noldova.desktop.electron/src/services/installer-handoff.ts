/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import type { IWindowsProcessApi } from "@noldova/desktop.runtime";

import { InstallerNotCopiedException } from "../exceptions/installer-not-copied.exception.js";
import { InstallerNotHeldException } from "../exceptions/installer-not-held.exception.js";
import { UpdateChangedBeforeHandoffException } from "../exceptions/update-changed-before-handoff.exception.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import { Resources } from "../resources.js";
import { UpdateController } from "./update-controller.js";

export class InstallerHandoff implements IUpdateHandoff {
  private readonly folder: string;
  private readonly protectAsync: (folder: string) => Promise<void>;
  private readonly files: Pick<IWindowsProcessApi, "openFileForReading" | "closeHandle">;
  private readonly startAsync: (installer: string) => Promise<number>;
  private readonly log: (text: string) => void;

  public readonly refusal: string | null = null;

  public constructor(
    installationFolder: string,
    protectAsync: (folder: string) => Promise<void>,
    files: Pick<IWindowsProcessApi, "openFileForReading" | "closeHandle">,
    startAsync: (installer: string) => Promise<number>,
    log: (text: string) => void) {
    this.folder = join(installationFolder, Resources.handoffFolder);
    this.protectAsync = protectAsync;
    this.files = files;
    this.startAsync = startAsync;
    this.log = log;
  }

  public async clearAsync(): Promise<void> {
    await rm(this.folder, { recursive: true, force: true }).catch((error: unknown) => this.log(Resources.formatHandoffNotRemoved(String(error))));
  }

  public async handOffAsync(record: UpdateReadyRecord): Promise<number> {
    const folder = join(this.folder, randomUUID());
    const installer = join(folder, basename(record.file));
    await this.copyAsync(folder, record.file, installer);
    const handle = this.files.openFileForReading(installer);
    if (Object.isNumber(handle)) {
      await this.removeAsync(folder);
      throw new InstallerNotHeldException(handle);
    }
    try {
      const hash = await UpdateController.hashFileAsync(installer).catch((error: unknown) => {
        throw new InstallerNotCopiedException(new ExceptionOptions(error));
      });
      if (hash !== record.sha512)
        throw new UpdateChangedBeforeHandoffException();
      return await this.startAsync(installer);
    }
    catch (error) {
      this.files.closeHandle(handle);
      await this.removeAsync(folder);
      throw error;
    }
  }

  private async copyAsync(folder: string, file: string, installer: string): Promise<void> {
    try {
      await mkdir(this.folder, { recursive: true });
      await mkdir(folder);
      await this.protectAsync(folder);
      await copyFile(file, installer, constants.COPYFILE_EXCL);
    }
    catch (error) {
      await this.removeAsync(folder);
      throw new InstallerNotCopiedException(new ExceptionOptions(error));
    }
  }

  private async removeAsync(folder: string): Promise<void> {
    await rm(folder, { recursive: true, force: true }).catch((error: unknown) => this.log(Resources.formatHandoffNotRemoved(String(error))));
  }
}
