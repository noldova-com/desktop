/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { AppImageSource } from "@noldova/desktop.runtime";

import type { IMainProcessEnvironment } from "../interfaces/i-main-process-environment.js";
import { Resources } from "../resources.js";
import { AppImageEnvironment } from "./app-image-environment.js";

export class TerminalRelaunch {
  private readonly process: IMainProcessEnvironment;
  private readonly argv: readonly string[];
  private readonly executablePath: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly workingDirectory: string;

  private constructor(process: IMainProcessEnvironment, argv: readonly string[], executablePath: string, environment: NodeJS.ProcessEnv, workingDirectory: string) {
    this.process = process;
    this.argv = argv;
    this.executablePath = executablePath;
    this.environment = environment;
    this.workingDirectory = workingDirectory;
  }

  public static find(process: IMainProcessEnvironment, argv: readonly string[], isPackaged: boolean): TerminalRelaunch | null {
    if (!isPackaged || !process.isTerminal || !Resources.relaunchPlatforms.includes(process.platform) || TerminalRelaunch.writesToTheTerminal(process, argv))
      return null;
    if (process.platform === Resources.windowsPlatform)
      return new TerminalRelaunch(process, argv, process.execPath, { ...process.env, [Resources.noConsoleVariable]: Resources.noConsoleValue }, process.workingDirectory);
    const source = process.platform === Resources.linuxPlatform ? AppImageSource.find(process.env, process.execPath) : null;
    return Object.isNull(source)
      ? new TerminalRelaunch(process, argv, process.execPath, process.env, process.workingDirectory)
      : new TerminalRelaunch(process, argv, source.file, AppImageEnvironment.restore(process.env), AppImageEnvironment.locateStartFolder(process));
  }

  public static forgetConsole(process: IMainProcessEnvironment): void {
    if (process.platform === Resources.windowsPlatform)
      delete process.env[Resources.noConsoleVariable];
  }

  public async startAsync(whenReady: () => Promise<unknown>): Promise<void> {
    if (this.process.platform !== Resources.windowsPlatform) {
      await this.process.startDetachedAsync(this.executablePath, this.argv.slice(1), this.environment, this.workingDirectory);
      return;
    }
    await whenReady();
    await this.process.startApartAsync(this.executablePath, this.argv.slice(1), this.environment);
  }

  private static writesToTheTerminal(process: IMainProcessEnvironment, argv: readonly string[]): boolean {
    return (process.env[Resources.enableLoggingVariable] ?? String.empty).length > 0
      || argv.slice(1).some(t => Resources.terminalArguments.some(u => t === u || t.startsWith(Resources.formatArgumentValuePrefix(u))));
  }
}
