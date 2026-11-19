/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, readlink } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ForegroundGroupReadFailedException } from "../../exceptions/foreground-group-read-failed.exception.js";
import { ForegroundGroupUnreadableException } from "../../exceptions/foreground-group-unreadable.exception.js";
import { SystemCommandException } from "../../exceptions/system-command.exception.js";
import { ForegroundProcess } from "../../models/foreground-process.js";
import { Resources } from "../../resources.js";
import { SystemCommand } from "../commands/system-command.js";
import { ProcessSignals } from "./process-signals.js";

export class ForegroundProcessGroupReader {
  private readonly platform: string;
  private readonly command: SystemCommand;
  private readonly processFolder: string;
  private readonly read: (file: string) => Promise<string>;
  private readonly readLink: (file: string) => Promise<string>;

  public constructor(platform: string, command: SystemCommand = new SystemCommand(), processFolder: string = Resources.processFolder,
    read: (file: string) => Promise<string> = t => readFile(t, Resources.utf8Encoding), readLink: (file: string) => Promise<string> = t => readlink(t)) {
    this.platform = platform;
    this.command = command;
    this.processFolder = processFolder;
    this.read = read;
    this.readLink = readLink;
  }

  public async readAsync(processId: number, started: Date): Promise<number | null> {
    return (await this.readStatusAsync(processId, started))?.[0] ?? null;
  }

  public async readProcessAsync(processId: number, started: Date): Promise<ForegroundProcess | null> {
    const status = await this.readStatusAsync(processId, started);
    if (Object.isNull(status))
      return null;
    const [group, name] = status;
    const own = this.platform === Resources.linuxPlatform ? await this.attemptAsync(processId, processId, () => this.readLink(this.executableOf(processId))) : name;
    if (Object.isNull(own))
      return null;
    const program = group === processId ? own : await this.attemptAsync(processId, group, () => this.readProgramAsync(group));
    return new ForegroundProcess(group, program, own);
  }

  private async readStatusAsync(processId: number, started: Date): Promise<readonly [number, string | null] | null> {
    if (this.platform === Resources.windowsPlatform)
      return null;
    const text = await this.attemptAsync(processId, processId, () => this.platform === Resources.linuxPlatform
      ? this.read(path.join(this.processFolder, String(processId), Resources.processStatFile))
      : this.command.runAsync(Resources.processStatusCommand, [...Resources.foregroundGroupArguments, String(processId)],
        { ...process.env, ...Resources.foregroundGroupEnvironment }, Resources.foregroundGroupTimeoutMilliseconds));
    if (Object.isNull(text))
      return null;
    const [isProgram, group, name] = this.platform === Resources.linuxPlatform
      ? ForegroundProcessGroupReader.fromStat(processId, text)
      : ForegroundProcessGroupReader.fromStatus(started, text);
    if (!Number.isInteger(group) || Object.isNull(isProgram))
      throw new ForegroundGroupUnreadableException(processId, text.trim());
    return isProgram && group > 0 ? [group, name] : null;
  }

  private async readProgramAsync(group: number): Promise<string> {
    if (this.platform === Resources.linuxPlatform)
      return await this.readLink(this.executableOf(group));
    const text = await this.command.runAsync(Resources.processStatusCommand, [...Resources.foregroundProgramArguments, String(group)],
      { ...process.env, ...Resources.foregroundGroupEnvironment }, Resources.foregroundGroupTimeoutMilliseconds);
    return text.trim();
  }

  private async attemptAsync<T>(processId: number, watched: number, read: () => Promise<T>): Promise<T | null> {
    try {
      return await read();
    }
    catch (error) {
      if (!ProcessSignals.isRunning(watched))
        return null;
      throw error instanceof SystemCommandException
        ? error
        : new ForegroundGroupReadFailedException(processId, error);
    }
  }

  private executableOf(processId: number): string {
    return path.join(this.processFolder, String(processId), Resources.processExecutableFile);
  }

  private static fromStat(processId: number, text: string): readonly [boolean | null, number, null] {
    const end = text.lastIndexOf(Resources.processNameEnd);
    const fields = end < 0 ? [] : text.slice(end + 1).trim().split(Resources.processStatFieldSeparator);
    const session = Number(fields[Resources.processSessionField]);
    return [Number.isInteger(session) ? session === processId : null, Number(fields[Resources.foregroundGroupField]), null];
  }

  private static fromStatus(started: Date, text: string): readonly [boolean | null, number, string | null] {
    const match = Resources.foregroundGroupStatusPattern.exec(text.trim());
    const start = Date.parse(match?.[1] ?? String.empty);
    const late = started.getTime() - start;
    return [Number.isNaN(start) ? null : late >= -Resources.posixStartMargin && late < Resources.secondMilliseconds + Resources.posixStartMargin, Number(match?.[2]),
      match?.[3] ?? null];
  }
}
