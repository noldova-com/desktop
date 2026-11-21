/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomUUID } from "node:crypto";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";
import { UpdateProcess } from "@noldova/desktop.protocol";

import { RemovalUnclaimedException } from "../../exceptions/removal-unclaimed.exception.js";
import { CaughtFailure } from "../../models/caught-failure.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import { FilePresence } from "./file-presence.js";
import { FileRenamer } from "./file-renamer.js";

export class StaleFileRemoval {
  private static readonly held: Set<string> = new Set<string>();

  private readonly renamer: FileRenamer = new FileRenamer();
  private readonly stampAsync: () => Promise<UpdateProcess | undefined>;
  private readonly isRunningAsync: (process: UpdateProcess) => Promise<boolean>;

  public readonly file: string;

  public constructor(file: string, stampAsync: () => Promise<UpdateProcess | undefined>, isRunningAsync: (process: UpdateProcess) => Promise<boolean>) {
    this.file = file;
    this.stampAsync = stampAsync;
    this.isRunningAsync = isRunningAsync;
  }

  public async removeAsync(text: string): Promise<boolean> {
    for (let attempt = 1; ; attempt++) {
      const stamp = await this.stampAsync();
      if (Object.isUndefined(stamp))
        throw new RemovalUnclaimedException(this.file);
      const intent = await this.intendAsync(stamp);
      try {
        if (await this.isAloneAsync(intent, stamp))
          return await this.removeJudgedAsync(text);
      }
      finally {
        StaleFileRemoval.held.delete(intent);
        await StaleFileRemoval.discardAsync(intent);
      }
      if (attempt >= Resources.removalAttempts)
        return false;
      await delay(Resources.replaceRetryDelay * (1 + Math.random()));
    }
  }

  private async intendAsync(stamp: UpdateProcess): Promise<string> {
    const unique = randomUUID();
    const name = path.basename(this.file);
    const intent = path.join(path.dirname(this.file), Resources.formatRemovalIntentName(name, unique));
    const temporary = path.join(path.dirname(this.file), Resources.formatTemporaryName(name, unique));
    StaleFileRemoval.held.add(intent);
    try {
      await writeFile(temporary, JSON.stringify(stamp.toJson()));
      await this.renamer.renameAsync(temporary, intent);
    }
    catch (error) {
      StaleFileRemoval.held.delete(intent);
      await StaleFileRemoval.discardAsync(temporary);
      throw error;
    }
    return intent;
  }

  private async isAloneAsync(intent: string, stamp: UpdateProcess): Promise<boolean> {
    const prefix = `${path.basename(this.file)}.`;
    const names = await readdir(path.dirname(this.file));
    const others = names.filter(t => t.startsWith(prefix) && t.endsWith(Resources.removalIntentSuffix) && t !== path.basename(intent));
    for (const name of others) {
      if (await this.isLiveAsync(path.join(path.dirname(this.file), name), stamp))
        return false;
    }
    return true;
  }

  private async isLiveAsync(intent: string, stamp: UpdateProcess): Promise<boolean> {
    let text: string | null;
    try {
      text = await FilePresence.unlessMissingAsync(readFile(intent, Resources.utf8Encoding));
    }
    catch (error) {
      if (!SystemErrorCode.isAny(error, Resources.busyFileErrorCodes))
        throw error;
      return true;
    }
    if (Object.isNull(text))
      return false;
    const holder = StaleFileRemoval.parse(text);
    if (!Object.isNull(holder) && (StaleFileRemoval.isSameProcess(holder, stamp) ? StaleFileRemoval.held.has(intent) : await this.isRunningAsync(holder)))
      return true;
    await StaleFileRemoval.discardAsync(intent);
    return false;
  }

  private async removeJudgedAsync(text: string): Promise<boolean> {
    const current = await FilePresence.unlessMissingAsync(readFile(this.file, Resources.utf8Encoding));
    if (Object.isNull(current))
      return true;
    if (current !== text)
      return false;
    await rm(this.file, { force: true });
    return true;
  }

  private static isSameProcess(holder: UpdateProcess, stamp: UpdateProcess): boolean {
    return holder.processId === stamp.processId && holder.earliest <= stamp.latest && stamp.earliest <= holder.latest;
  }

  private static async discardAsync(file: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await rm(file, { force: true });
        return;
      }
      catch (error) {
        if (!SystemErrorCode.isAny(error, Resources.busyFileErrorCodes))
          throw error;
        if (attempt >= Resources.replaceAttempts)
          return;
      }
      await delay(Resources.replaceRetryDelay);
    }
  }

  private static parse(text: string): UpdateProcess | null {
    try {
      return UpdateProcess.fromJson(JsonReader.parse(text).toJson());
    }
    catch (error) {
      CaughtFailure.expect(error, JsonException);
      return null;
    }
  }
}
