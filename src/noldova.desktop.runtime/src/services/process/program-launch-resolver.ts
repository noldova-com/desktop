/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ProcessLaunch } from "../../models/process-launch.js";
import { SystemErrorCode } from "../../models/system-error-code.js";
import { Resources } from "../../resources.js";
import { BatchCommandLine } from "./batch-command-line.js";
import type { ProcessEnvironment } from "./process-environment.js";
import { ProgramLocator } from "./program-locator.js";

export class ProgramLaunchResolver {
  private readonly isWindows: boolean;
  private readonly runtime: NodeJS.ProcessEnv;
  private readonly locator: ProgramLocator;

  public constructor(platform: string, runtime: NodeJS.ProcessEnv) {
    this.isWindows = platform === Resources.windowsPlatform;
    this.runtime = runtime;
    this.locator = new ProgramLocator(platform);
  }

  public async resolveAsync(file: string, launchArguments: readonly string[], environment: ProcessEnvironment, isVerbatim: boolean = false): Promise<ProcessLaunch> {
    if (!this.isWindows || !Resources.batchExtensions.includes(path.extname(file).toLowerCase()))
      return new ProcessLaunch(file, launchArguments, this.isWindows && isVerbatim);
    const shim = await ProgramLaunchResolver.readShimAsync(file);
    if (!Object.isNull(shim) && await ProgramLaunchResolver.isFileAsync(shim[0])) {
      const [target, runsNode] = shim;
      const extension = path.extname(target).toLowerCase();
      if (!runsNode && extension === Resources.nativeProgramExtension)
        return new ProcessLaunch(target, launchArguments, false);
      if (runsNode && Resources.scriptExtensions.includes(extension))
        return new ProcessLaunch(await this.locateNodeAsync(path.dirname(file), environment), [target, ...launchArguments], false);
    }
    return BatchCommandLine.create(this.runtime, file, launchArguments);
  }

  private async locateNodeAsync(folder: string, environment: ProcessEnvironment): Promise<string> {
    const beside = path.join(folder, Resources.nodeProgramName);
    return await ProgramLaunchResolver.isFileAsync(beside) ? beside : this.locator.locateAsync(Resources.nodeProgramName, environment);
  }

  private static async isFileAsync(file: string): Promise<boolean> {
    try {
      return (await stat(file)).isFile();
    }
    catch (error) {
      if (SystemErrorCode.isAny(error, Resources.missingPathCodes))
        return false;
      throw error;
    }
  }

  private static async readShimAsync(shim: string): Promise<readonly [string, boolean] | null> {
    let text: string;
    try {
      text = await readFile(shim, Resources.utf8Encoding);
    }
    catch (error) {
      if (SystemErrorCode.isAny(error, Resources.missingPathCodes))
        return null;
      throw error;
    }
    const lines = text.split(Resources.lineBreakPattern).map(t => t.replaceAll(Resources.shimBlankPattern, Resources.commandLineSeparator));
    if (lines.at(-1) === String.empty)
      lines.pop();
    const last = lines.at(-1);
    if (Object.isUndefined(last))
      return null;
    const pattern = ProgramLaunchResolver.choosePattern(lines);
    const target = pattern?.exec(last)?.[1];
    return Object.isUndefined(target) ? null : [path.join(path.dirname(shim), ...target.split(Resources.pathSeparatorPattern)), pattern === Resources.shimNodeLinePattern];
  }

  private static choosePattern(lines: readonly string[]): RegExp | null {
    const head = Resources.shimHead.length;
    if (lines.length === 1)
      return Resources.shimOneLinePattern;
    if (!ProgramLaunchResolver.startsWith(lines, Resources.shimHead, 0))
      return null;
    if (lines.length === head + 1)
      return Resources.shimProgramLinePattern;
    const isNodeShim = lines.length === head + Resources.shimNodeBody.length + 1 && ProgramLaunchResolver.startsWith(lines, Resources.shimNodeBody, head);
    return isNodeShim ? Resources.shimNodeLinePattern : null;
  }

  private static startsWith(lines: readonly string[], template: readonly string[], from: number): boolean {
    return template.every((t, i) => lines[from + i] === t);
  }
}
