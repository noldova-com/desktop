/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Stats, statSync } from "node:fs";
import { stat } from "node:fs/promises";

import "@noldova/context.core";

import { DebianInstallerMissingException } from "../exceptions/debian-installer-missing.exception.js";
import { DebianPackageNotInstalledException } from "../exceptions/debian-package-not-installed.exception.js";
import { DebianUpdateArgumentsRefusedException } from "../exceptions/debian-update-arguments-refused.exception.js";
import { DebianUpdateInstallerMissingException } from "../exceptions/debian-update-installer-missing.exception.js";
import { UpdateChangedBeforeHandoffException } from "../exceptions/update-changed-before-handoff.exception.js";
import type { UpdateHandoffException } from "../exceptions/update-handoff.exception.js";
import { UpdateUnsignedAtHandoffException } from "../exceptions/update-unsigned-at-handoff.exception.js";
import type { IUpdateHandoff } from "../interfaces/i-update-handoff.js";
import type { UpdateReadyRecord } from "../models/update-ready-record.js";
import { Resources } from "../resources.js";
import { UpdateController } from "./update-controller.js";

export class DebianHandoff implements IUpdateHandoff {
  private readonly installer: string | null;
  private readonly updateInstaller: string | null;
  private readonly runAsync: (program: string, programArguments: readonly string[]) => Promise<unknown>;
  private readonly verifyAsync: (record: UpdateReadyRecord) => Promise<string | null>;

  public constructor(installer: string | null, updateInstaller: string | null, runAsync: (program: string, programArguments: readonly string[]) => Promise<unknown>,
    verifyAsync: (record: UpdateReadyRecord) => Promise<string | null>) {
    this.installer = installer;
    this.updateInstaller = updateInstaller;
    this.runAsync = runAsync;
    this.verifyAsync = verifyAsync;
  }

  public get refusal(): string | null {
    if (Object.isNull(this.installer))
      return Resources.debianInstallerMissing;
    return Object.isNull(this.updateInstaller) ? Resources.debianUpdateInstallerMissing : null;
  }

  public static findUpdateInstaller(file: string): string | null {
    try {
      return DebianHandoff.isOnlyRootsToChange(statSync(file)) ? file : null;
    }
    catch {
      return null;
    }
  }

  public static isOnlyRootsToChange(status: Pick<Stats, "isFile" | "uid" | "mode">): boolean {
    return status.isFile() && status.uid === Resources.rootUserId && (status.mode & Resources.writableByOthersMode) === 0;
  }

  private static describeFailure(file: string, error: unknown): UpdateHandoffException {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === Resources.debianUpdateChangedCode)
      return new UpdateChangedBeforeHandoffException();
    if (code === Resources.debianUpdateArgumentsRefusedCode)
      return new DebianUpdateArgumentsRefusedException(file);
    return new DebianPackageNotInstalledException(file, error);
  }

  public async handOffAsync(record: UpdateReadyRecord): Promise<null> {
    if (Object.isNull(this.installer))
      throw new DebianInstallerMissingException();
    if (Object.isNull(this.updateInstaller))
      throw new DebianUpdateInstallerMissingException();
    const size = await stat(record.file).then(t => t.size, () => null);
    if (Object.isNull(size) || await UpdateController.hashFileAsync(record.file).catch(() => null) !== record.sha512)
      throw new UpdateChangedBeforeHandoffException();
    const failure = await this.verifyAsync(record);
    if (!Object.isNull(failure))
      throw new UpdateUnsignedAtHandoffException(record.file, failure);
    try {
      await this.runAsync(this.installer, [this.updateInstaller, record.file, Buffer.from(record.sha512, Resources.base64Encoding).toString(Resources.hexEncoding),
        String(size)]);
    }
    catch (error) {
      throw DebianHandoff.describeFailure(record.file, error);
    }
    return null;
  }

  public clearAsync(): Promise<void> {
    return Promise.resolve();
  }
}
