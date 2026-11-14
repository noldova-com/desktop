/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawn } from "node:child_process";
import { devNull } from "node:os";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { ChildProcessStarter, type IProcessStarter } from "@noldova/desktop.runtime";

import { ProgramException } from "../exceptions/program.exception.js";
import type { IProgramHost } from "../interfaces/i-program-host.js";
import { StartedProgram } from "../models/started-program.js";
import { Resources } from "../resources.js";

export class ChildProgramHost implements IProgramHost {
  private readonly timeout: number;
  private readonly starter: IProcessStarter;

  public constructor(platform: string, timeout: number, starter: IProcessStarter = ChildProcessStarter.create(platform, false)) {
    this.timeout = timeout;
    this.starter = starter;
  }

  public runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      ArgumentException.throwIfNullOrWhitespace(file, Resources.executablePathParameter);
      execFile(
        file,
        [...programArguments],
        { encoding: Resources.textEncoding, env: environment, maxBuffer: Resources.programOutputLimit, shell: false, timeout: this.timeout, windowsHide: true },
        (error, output) => {
          if (Object.isNull(error))
            resolve(output);
          else
            reject(new ProgramException(file, error));
        });
    });
  }

  public start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram {
    ArgumentException.throwIfNullOrWhitespace(file, Resources.executablePathParameter);
    let isEnded = false;
    const end = (): void => {
      if (isEnded)
        return;
      isEnded = true;
      onExit();
    };
    const child = spawn(file, [...programArguments], { env: environment, shell: false, stdio: [Resources.ignoredStdio, Resources.pipedStdio, Resources.ignoredStdio], windowsHide: true });
    child.stdout.setEncoding(Resources.textEncoding);
    child.stdout.on(Resources.dataEvent, (t: string) => onOutput(t));
    child.on(Resources.errorEvent, end);
    child.on(Resources.closeEvent, end);
    return new StartedProgram(() => child.kill());
  }

  public startDetached(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onFailure: (error: Error) => void): void {
    ArgumentException.throwIfNullOrWhitespace(file, Resources.executablePathParameter);
    void this.starter.startAsync(file, programArguments, environment, devNull).catch(onFailure);
  }

  public async startDetachedAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, workingDirectory: string): Promise<void> {
    ArgumentException.throwIfNullOrWhitespace(file, Resources.executablePathParameter);
    await this.starter.startAsync(file, programArguments, environment, devNull, workingDirectory);
  }
}
