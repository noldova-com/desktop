/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { UpdateProcess } from "@noldova/desktop.protocol";
import { StaleFileRemoval } from "@noldova/desktop.runtime";

import { UpdateCheckerUnknownException } from "../exceptions/update-checker-unknown.exception.js";
import type { IUpdateCheckLock } from "../interfaces/i-update-check-lock.js";
import { ErrorCode } from "../models/error-code.js";
import { Resources } from "../resources.js";

export class UpdateCheckLock implements IUpdateCheckLock {
  private readonly folder: string;
  private readonly file: string;
  private readonly stampAsync: () => Promise<UpdateProcess | null>;
  private readonly isRunningAsync: (holder: UpdateProcess) => Promise<boolean>;
  private readonly log: (text: string) => void;
  private readonly removal: StaleFileRemoval;
  private process: UpdateProcess | undefined;
  private holder: string | undefined;
  private held: string | undefined;

  public constructor(folder: string, stampAsync: () => Promise<UpdateProcess | null>, isRunningAsync: (holder: UpdateProcess) => Promise<boolean>, log: (text: string) => void) {
    this.folder = folder;
    this.file = join(folder, Resources.updateCheckLockFile);
    this.stampAsync = stampAsync;
    this.isRunningAsync = isRunningAsync;
    this.log = log;
    this.removal = new StaleFileRemoval(this.file, () => Promise.resolve(this.process), t => this.isRunningAsync(t));
    this.process = undefined;
    this.holder = undefined;
    this.held = undefined;
  }

  public async tryAcquireAsync(): Promise<boolean> {
    const text = await this.identifyAsync();
    await mkdir(this.folder, { recursive: true });
    if (await this.createAsync(text))
      return this.hold(text);
    const current = await readFile(this.file, Resources.textEncoding).catch(() => null);
    if (current === text)
      return this.hold(text);
    if (Object.isNull(current) || await this.isHeldAsync(current) || !await this.removal.removeAsync(current))
      return false;
    return await this.createAsync(text) && this.hold(text);
  }

  public async releaseAsync(): Promise<void> {
    const held = this.held;
    this.held = undefined;
    if (Object.isUndefined(held))
      return;
    try {
      await this.removal.removeAsync(held);
    }
    catch (error) {
      this.log(Resources.formatUpdateLockLeft(String(error)));
    }
  }

  private async identifyAsync(): Promise<string> {
    if (Object.isUndefined(this.holder)) {
      const holder = await this.stampAsync();
      if (Object.isNull(holder))
        throw new UpdateCheckerUnknownException();
      this.process = holder;
      this.holder = JSON.stringify(holder.toJson());
    }
    return this.holder;
  }

  private hold(text: string): boolean {
    this.held = text;
    return true;
  }

  private async isHeldAsync(text: string): Promise<boolean> {
    const holder = UpdateCheckLock.parse(text);
    return !Object.isNull(holder) && await this.isRunningAsync(holder);
  }

  private async createAsync(text: string): Promise<boolean> {
    const temporary = this.temporaryName();
    await writeFile(temporary, text);
    try {
      await link(temporary, this.file);
      return true;
    }
    catch (error) {
      if (!UpdateCheckLock.hasCode(error, Resources.existingErrorCode))
        throw error;
      return false;
    }
    finally {
      await rm(temporary, { force: true });
    }
  }

  private temporaryName(): string {
    return Resources.formatTemporaryFile(this.file, randomUUID());
  }

  private static hasCode(error: unknown, code: string): boolean {
    return ErrorCode.isOneOf(error, [code]);
  }

  private static parse(text: string): UpdateProcess | null {
    try {
      return UpdateProcess.fromJson(JsonReader.parse(text).toJson());
    }
    catch {
      return null;
    }
  }
}
