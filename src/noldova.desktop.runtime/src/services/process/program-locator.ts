/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants, type Stats } from "node:fs";
import { access, lstat, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ProgramNotFoundException } from "../../exceptions/program-not-found.exception.js";
import { ProgramPathRelativeException } from "../../exceptions/program-path-relative.exception.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import type { ProcessEnvironment } from "./process-environment.js";

export class ProgramLocator {
  private readonly isWindows: boolean;
  private readonly stat: (file: string) => Promise<Stats>;
  private readonly lstat: (file: string) => Promise<Stats>;

  public constructor(platform: string, readStats: (file: string) => Promise<Stats> = stat, readLinkStats: (file: string) => Promise<Stats> = lstat) {
    this.isWindows = platform === Resources.windowsPlatform;
    this.stat = readStats;
    this.lstat = readLinkStats;
  }

  public async locateAsync(program: string, environment: ProcessEnvironment): Promise<string> {
    const folders = this.isAbsolute(program) ? [path.dirname(program)] : this.listFolders(program, environment);
    const candidates = this.listCandidates(path.basename(program), environment);
    for (const folder of folders) {
      for (const file of candidates.map(t => path.join(folder, t))) {
        if (await this.isProgramAsync(file))
          return file;
      }
    }
    throw new ProgramNotFoundException(program);
  }

  private isAbsolute(file: string): boolean {
    return path.isAbsolute(file) && path.parse(path.resolve(file)).root.toLowerCase() === path.parse(path.normalize(file)).root.toLowerCase();
  }

  private listFolders(program: string, environment: ProcessEnvironment): readonly string[] {
    if ((this.isWindows ? Resources.windowsNamePattern : Resources.pathSeparatorPattern).test(program))
      throw new ProgramPathRelativeException(program);
    const value = environment.read(Resources.pathVariable) ?? String.empty;
    return (this.isWindows ? ProgramLocator.splitWindowsPath(value) : value.split(Resources.posixPathDelimiter)).filter(t => this.isAbsolute(t));
  }

  private static splitWindowsPath(value: string): readonly string[] {
    const entries: string[] = [];
    let start = 0;
    while (start <= value.length) {
      const closing = value.startsWith(Resources.windowsPathQuote, start) ? value.indexOf(Resources.windowsPathQuote, start + 1) : start;
      const delimiter = closing < 0 ? -1 : value.indexOf(Resources.windowsPathDelimiter, closing);
      const end = delimiter < 0 ? value.length : delimiter;
      entries.push(ProgramLocator.unquote(value.slice(start, end)));
      start = end + 1;
    }
    return entries;
  }

  private static unquote(entry: string): string {
    const opened = entry.startsWith(Resources.windowsPathQuote) ? entry.slice(1) : entry;
    return opened.endsWith(Resources.windowsPathQuote) ? opened.slice(0, -1) : opened;
  }

  private listCandidates(name: string, environment: ProcessEnvironment): readonly string[] {
    if (!this.isWindows)
      return [name];
    const configured = environment.read(Resources.programExtensionsVariable);
    const named = (Object.isUndefined(configured) || String.isNullOrWhitespace(configured) ? Resources.defaultProgramExtensions : configured)
      .split(Resources.windowsPathDelimiter)
      .map(t => t.trim().toLowerCase())
      .filter(t => Resources.programExtensions.includes(t))
      .map(t => `${name}${t}`);
    return Resources.programExtensions.includes(path.extname(name).toLowerCase()) ? [name, ...named] : named;
  }

  private async isProgramAsync(file: string): Promise<boolean> {
    try {
      if (!(await this.stat(file)).isFile())
        return false;
      if (!this.isWindows)
        await access(file, constants.X_OK);
      return true;
    }
    catch (error) {
      return this.isWindows && SystemErrorCode.isAny(error, Resources.refusedLinkCodes) && await this.isLinkAsync(file);
    }
  }

  private async isLinkAsync(file: string): Promise<boolean> {
    try {
      return (await this.lstat(file)).isSymbolicLink();
    }
    catch (error) {
      if (SystemErrorCode.isAny(error, Resources.unreadableLinkCodes))
        return false;
      throw error;
    }
  }
}
