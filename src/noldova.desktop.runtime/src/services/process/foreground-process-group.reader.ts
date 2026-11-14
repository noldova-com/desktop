/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ForegroundGroupReadFailedException } from "../../exceptions/foreground-group-read-failed.exception.js";
import { ForegroundGroupUnreadableException } from "../../exceptions/foreground-group-unreadable.exception.js";
import { SystemCommandException } from "../../exceptions/system-command.exception.js";
import { Resources } from "../../resources.js";
import { SystemCommand } from "../commands/system-command.js";
import { ProcessSignals } from "./process-signals.js";

export class ForegroundProcessGroupReader {
  private readonly platform: string;
  private readonly command: SystemCommand;
  private readonly processFolder: string;
  private readonly read: (file: string) => Promise<string>;

  public constructor(platform: string, command: SystemCommand = new SystemCommand(), processFolder: string = Resources.processFolder,
    read: (file: string) => Promise<string> = t => readFile(t, Resources.utf8Encoding)) {
    this.platform = platform;
    this.command = command;
    this.processFolder = processFolder;
    this.read = read;
  }

  public async readAsync(processId: number, started: Date): Promise<number | null> {
    if (this.platform === Resources.windowsPlatform)
      return null;
    let text: string;
    try {
      text = this.platform === Resources.linuxPlatform
        ? await this.read(path.join(this.processFolder, String(processId), Resources.processStatFile))
        : await this.command.runAsync(Resources.processStatusCommand, [...Resources.foregroundGroupArguments, String(processId)],
          { ...process.env, ...Resources.foregroundGroupEnvironment }, Resources.foregroundGroupTimeoutMilliseconds);
    }
    catch (error) {
      if (!ProcessSignals.isRunning(processId))
        return null;
      throw error instanceof SystemCommandException
        ? error
        : new ForegroundGroupReadFailedException(processId, error);
    }
    const [isProgram, group] = this.platform === Resources.linuxPlatform
      ? ForegroundProcessGroupReader.fromStat(processId, text)
      : ForegroundProcessGroupReader.fromStatus(started, text);
    if (!Number.isInteger(group) || Object.isNull(isProgram))
      throw new ForegroundGroupUnreadableException(processId, text.trim());
    return isProgram && group > 0 ? group : null;
  }

  private static fromStat(processId: number, text: string): readonly [boolean | null, number] {
    const end = text.lastIndexOf(Resources.processNameEnd);
    const fields = end < 0 ? [] : text.slice(end + 1).trim().split(Resources.processStatFieldSeparator);
    const session = Number(fields[Resources.processSessionField]);
    return [Number.isInteger(session) ? session === processId : null, Number(fields[Resources.foregroundGroupField])];
  }

  private static fromStatus(started: Date, text: string): readonly [boolean | null, number] {
    const match = Resources.foregroundGroupStatusPattern.exec(text.trim());
    const start = Date.parse(match?.[1] ?? String.empty);
    const late = started.getTime() - start;
    return [Number.isNaN(start) ? null : late >= -Resources.posixStartMargin && late < Resources.secondMilliseconds + Resources.posixStartMargin, Number(match?.[2])];
  }
}
