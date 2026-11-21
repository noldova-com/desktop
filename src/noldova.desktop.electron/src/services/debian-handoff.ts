/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { DebianInstallerMissingException } from "../exceptions/debian-installer-missing.exception.js";
import { DebianPackageNotInstalledException } from "../exceptions/debian-package-not-installed.exception.js";
import { UpdateChangedBeforeHandoffException } from "../exceptions/update-changed-before-handoff.exception.js";
import { UpdateUnsignedAtHandoffException } from "../exceptions/update-unsigned-at-handoff.exception.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import { Resources } from "../resources.js";
import { UpdateController } from "./update-controller.js";

export class DebianHandoff implements IUpdateHandoff {
  private readonly installer: string | null;
  private readonly runAsync: (program: string, programArguments: readonly string[]) => Promise<unknown>;
  private readonly verifyAsync: (record: UpdateReadyRecord) => Promise<string | null>;

  public constructor(installer: string | null, runAsync: (program: string, programArguments: readonly string[]) => Promise<unknown>,
    verifyAsync: (record: UpdateReadyRecord) => Promise<string | null>) {
    this.installer = installer;
    this.runAsync = runAsync;
    this.verifyAsync = verifyAsync;
  }

  public get refusal(): string | null {
    return Object.isNull(this.installer) ? Resources.debianInstallerMissing : null;
  }

  public async handOffAsync(record: UpdateReadyRecord): Promise<null> {
    if (Object.isNull(this.installer))
      throw new DebianInstallerMissingException();
    if (await UpdateController.hashFileAsync(record.file).catch(() => null) !== record.sha512)
      throw new UpdateChangedBeforeHandoffException();
    const failure = await this.verifyAsync(record);
    if (!Object.isNull(failure))
      throw new UpdateUnsignedAtHandoffException(record.file, failure);
    try {
      await this.runAsync(this.installer, [...Resources.debianInstallerArguments, record.file]);
    }
    catch (error) {
      throw new DebianPackageNotInstalledException(record.file, error);
    }
    return null;
  }

  public clearAsync(): Promise<void> {
    return Promise.resolve();
  }
}
