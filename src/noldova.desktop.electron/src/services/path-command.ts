/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Stats } from "node:fs";
import { lstat, readlink, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";

import "@noldova/context.core";
import { FolderCreation } from "@noldova/desktop.runtime";

import { PathCommandOutcome } from "../enums/path-command-outcome.js";
import { PathCommandException } from "../exceptions/path-command.exception.js";
import type { IPathCommandFiles } from "../interfaces/i-path-command-files.js";
import { ErrorCode } from "../models/error-code.js";
import { Resources } from "../resources.js";
import { FilePresence } from "./file-presence.js";

export class PathCommand {
  private readonly target: string;
  private readonly link: string;
  private readonly files: IPathCommandFiles;
  private readonly runProgramAsync: (program: string, args: readonly string[]) => Promise<void>;

  public constructor(target: string, link: string, files: IPathCommandFiles, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>) {
    this.target = target;
    this.link = link;
    this.files = files;
    this.runProgramAsync = runProgramAsync;
  }

  public static forBundle(executablePath: string, runProgramAsync: (program: string, args: readonly string[]) => Promise<void>): PathCommand {
    return new PathCommand(
      join(dirname(executablePath), ...Resources.bundleCommandSegments, Resources.commandName),
      join(Resources.pathCommandFolder, Resources.commandName),
      { lstat, readlink, rm, mkdir: folder => FolderCreation.createAsync(folder), symlink },
      runProgramAsync);
  }

  public get linkPath(): string {
    return this.link;
  }

  public async installAsync(): Promise<PathCommandOutcome> {
    if (!await FilePresence.existsAsync(this.target))
      return PathCommandOutcome.Missing;
    try {
      const stats = await this.readStatsAsync();
      if (!Object.isNull(stats) && !stats.isSymbolicLink())
        return PathCommandOutcome.Occupied;
      if (!Object.isNull(stats) && await this.files.readlink(this.link) === this.target)
        return PathCommandOutcome.AlreadyInstalled;
      if (!Object.isNull(stats))
        await this.files.rm(this.link);
      await this.files.mkdir(dirname(this.link), { recursive: true });
      await this.files.symlink(this.target, this.link);
      return PathCommandOutcome.Installed;
    }
    catch (error) {
      if (!PathCommand.hasCode(error, Resources.deniedErrorCodes))
        throw new PathCommandException(this.link, error);
    }
    try {
      await this.runProgramAsync(Resources.scriptRunner, [...Resources.administratorScript, this.target, dirname(this.link), this.link, Resources.formatAdministratorPrompt(this.link)]);
      return PathCommandOutcome.Installed;
    }
    catch (error) {
      if (String(error).includes(Resources.userCancelledCode))
        return PathCommandOutcome.Cancelled;
      if (String(error).includes(Resources.occupiedExitCode))
        return PathCommandOutcome.Occupied;
      throw new PathCommandException(this.link, error);
    }
  }

  private async readStatsAsync(): Promise<Stats | null> {
    try {
      return await this.files.lstat(this.link);
    }
    catch (error) {
      if (PathCommand.hasCode(error, [Resources.missingErrorCode]))
        return null;
      throw error;
    }
  }

  private static hasCode(error: unknown, codes: readonly string[]): boolean {
    return ErrorCode.isOneOf(error, codes);
  }
}
