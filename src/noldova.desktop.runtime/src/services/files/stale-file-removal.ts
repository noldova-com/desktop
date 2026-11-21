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
      const intent = await this.intendAsync();
      try {
        if (await this.isAloneAsync(intent))
          return await this.removeJudgedAsync(text);
      }
      finally {
        await rm(intent, { force: true });
      }
      if (attempt >= Resources.removalAttempts)
        return false;
      await delay(Resources.replaceRetryDelay * (1 + Math.random()));
    }
  }

  private async intendAsync(): Promise<string> {
    const stamp = await this.stampAsync();
    if (Object.isUndefined(stamp))
      throw new RemovalUnclaimedException(this.file);
    const unique = randomUUID();
    const name = path.basename(this.file);
    const intent = path.join(path.dirname(this.file), Resources.formatRemovalIntentName(name, unique));
    const temporary = path.join(path.dirname(this.file), Resources.formatTemporaryName(name, unique));
    await writeFile(temporary, JSON.stringify(stamp.toJson()));
    await this.renamer.renameAsync(temporary, intent);
    return intent;
  }

  private async isAloneAsync(intent: string): Promise<boolean> {
    const prefix = `${path.basename(this.file)}.`;
    const names = await readdir(path.dirname(this.file));
    const others = names.filter(t => t.startsWith(prefix) && t.endsWith(Resources.removalIntentSuffix) && t !== path.basename(intent));
    for (const name of others) {
      if (await this.isLiveAsync(path.join(path.dirname(this.file), name)))
        return false;
    }
    return true;
  }

  private async isLiveAsync(intent: string): Promise<boolean> {
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
    if (!Object.isNull(holder) && await this.isRunningAsync(holder))
      return true;
    await rm(intent, { force: true });
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
