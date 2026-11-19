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
    if (this.platform === Resources.windowsPlatform)
      return null;
    const text = await this.attemptAsync(processId, processId, () => this.platform === Resources.linuxPlatform
      ? this.read(this.fileOf(processId, Resources.processStatFile))
      : this.runStatusAsync([...Resources.foregroundGroupArguments, String(processId)]));
    if (Object.isNull(text))
      return null;
    const [isProgram, group] = this.platform === Resources.linuxPlatform
      ? ForegroundProcessGroupReader.fromStat(processId, text)
      : ForegroundProcessGroupReader.fromStatus(started, text);
    if (!Number.isInteger(group) || Object.isNull(isProgram))
      throw new ForegroundGroupUnreadableException(processId, text.trim());
    return isProgram && group > 0 ? group : null;
  }

  public async readProcessAsync(processId: number, started: Date): Promise<ForegroundProcess | null> {
    const group = await this.readAsync(processId, started);
    if (Object.isNull(group))
      return null;
    const programs = this.platform === Resources.linuxPlatform
      ? await this.readLinuxProgramsAsync(processId, group)
      : await this.readMacProgramsAsync(processId, group);
    const own = programs.get(processId);
    if (Object.isUndefined(own))
      return null;
    const leader = programs.get(group);
    return new ForegroundProcess(group, leader?.[0] ?? null, leader?.[1] ?? null, own[0], own[1]);
  }

  private async readLinuxProgramsAsync(processId: number, group: number): Promise<ReadonlyMap<number, readonly [string, string]>> {
    const programs = new Map<number, readonly [string, string]>();
    for (const id of new Set([processId, group])) {
      const program = await this.attemptAsync(processId, id, async () => {
        const file = await this.readLink(this.fileOf(id, Resources.processExecutableFile));
        const commandLine = await this.read(this.fileOf(id, Resources.processCommandLineFile));
        return [file, commandLine.replace(Resources.processArgumentsEndPattern, String.empty).split(Resources.processArgumentSeparator).join(Resources.commandLineSeparator)] as const;
      });
      if (!Object.isNull(program))
        programs.set(id, program);
    }
    return programs;
  }

  private async readMacProgramsAsync(processId: number, group: number): Promise<ReadonlyMap<number, readonly [string, string]>> {
    const ids = [...new Set([processId, group])].join(Resources.processIdListSeparator);
    const names = await this.attemptAsync(processId, processId, () => this.runStatusAsync([...Resources.foregroundProgramArguments, ids]));
    const lines = await this.attemptAsync(processId, processId, () => this.runStatusAsync([...Resources.foregroundCommandLineArguments, ids]));
    const commandLines = ForegroundProcessGroupReader.rowsOf(processId, lines ?? String.empty);
    const programs = new Map<number, readonly [string, string]>();
    for (const [id, name] of ForegroundProcessGroupReader.rowsOf(processId, names ?? String.empty)) {
      const commandLine = commandLines.get(id);
      if (!Object.isUndefined(commandLine))
        programs.set(id, [name, commandLine]);
    }
    return programs;
  }

  private runStatusAsync(commandArguments: readonly string[]): Promise<string> {
    return this.command.runAsync(Resources.processStatusCommand, commandArguments, { ...process.env, ...Resources.foregroundGroupEnvironment },
      Resources.foregroundGroupTimeoutMilliseconds);
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

  private fileOf(processId: number, name: string): string {
    return path.join(this.processFolder, String(processId), name);
  }

  private static rowsOf(processId: number, text: string): ReadonlyMap<number, string> {
    const rows = new Map<number, string>();
    for (const line of text.split(Resources.lineBreakPattern).filter(t => t.trim() !== String.empty)) {
      const match = Resources.foregroundRowPattern.exec(line);
      if (Object.isNull(match))
        throw new ForegroundGroupUnreadableException(processId, line.trim());
      rows.set(Number(match[1]), String(match[2]));
    }
    return rows;
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
