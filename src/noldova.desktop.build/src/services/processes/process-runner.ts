/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { ProcessResult } from "../../models/processes/process-result.ts";
import { ProcessTimeoutException } from "../../exceptions/process-timeout.exception.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";
import { StartedProcess } from "./started-process.ts";

export class ProcessRunner {
  public captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    return new Promise<ProcessResult>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: [Resources.ignoreStdio, Resources.pipeStdio, Resources.pipeStdio], windowsHide: true, env: environment ?? process.env });
      const output: Buffer[] = [];
      const errorOutput: Buffer[] = [];
      let size = 0;
      let failure: BuildException | null = null;
      const stop = (t: BuildException): void => {
        failure ??= t;
        child.kill();
      };
      const receive = (chunks: Buffer[], chunk: Buffer): void => {
        size += chunk.length;
        if (size > Resources.processOutputLimit)
          stop(new BuildException(Resources.formatProcessOutputTooLarge(command)));
        else
          chunks.push(chunk);
      };
      const timer = setTimeout(() => stop(new ProcessTimeoutException(command, timeout)), timeout);
      child.stdout.on(Resources.dataEvent, (t: Buffer) => receive(output, t));
      child.stderr.on(Resources.dataEvent, (t: Buffer) => receive(errorOutput, t));
      child.on(Resources.errorEvent, t => stop(new BuildException(Resources.formatProcessNotStarted(command), new ExceptionOptions(t))));
      child.on(Resources.closeEvent, t => {
        clearTimeout(timer);
        if (Object.isNull(failure))
          resolve(new ProcessResult(t, Buffer.concat(output).toString(Resources.textEncoding), Buffer.concat(errorOutput).toString(Resources.textEncoding)));
        else
          reject(failure);
      });
    });
  }

  public async requireAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<void> {
    const result = await this.captureAsync(command, commandArguments, directory, timeout, environment);
    if (!result.isSuccessful)
      throw new BuildException(Resources.formatProcessFailed(path.basename(command), commandArguments, result.exitCode, result.text));
  }

  public runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv, watch?: (text: string) => void): Promise<number | null> {
    if (!Object.isUndefined(watch))
      return ProcessRunner.runWatchedAsync(command, commandArguments, directory, environment ?? process.env, watch);
    return new Promise<number | null>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: Resources.inheritStdio, env: environment ?? process.env });
      child.on(Resources.errorEvent, t => reject(new BuildException(Resources.formatProcessNotStarted(command), new ExceptionOptions(t))));
      child.on(Resources.closeEvent, t => resolve(t));
    });
  }

  public startAsync(command: string, commandArguments: readonly string[], directory: string, log: string): Promise<StartedProcess> {
    return new Promise<StartedProcess>((resolve, reject) => {
      const file = openSync(log, Resources.logFileFlag);
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: [Resources.ignoreStdio, file, file] });
      closeSync(file);
      child.once(Resources.errorEvent, t => reject(new BuildException(Resources.formatProcessNotStarted(command), new ExceptionOptions(t))));
      child.once(Resources.spawnEvent, () => resolve(new StartedProcess(child)));
    });
  }

  public isRunning(processId: number): boolean {
    return ProcessRunner.signal(processId, 0);
  }

  public kill(processId: number): void {
    ProcessRunner.signal(processId, Resources.killSignal);
  }

  private static runWatchedAsync(command: string, commandArguments: readonly string[], directory: string, environment: NodeJS.ProcessEnv, watch: (text: string) => void):
    Promise<number | null> {
    return new Promise<number | null>((resolve, reject) => {
      const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: [Resources.inheritStdio, Resources.pipeStdio, Resources.pipeStdio], env: environment });
      child.stdout.on(Resources.dataEvent, (t: Buffer) => ProcessRunner.forward(process.stdout, t, watch));
      child.stderr.on(Resources.dataEvent, (t: Buffer) => ProcessRunner.forward(process.stderr, t, watch));
      child.on(Resources.errorEvent, t => reject(new BuildException(Resources.formatProcessNotStarted(command), new ExceptionOptions(t))));
      child.on(Resources.closeEvent, t => resolve(t));
    });
  }

  private static forward(target: NodeJS.WritableStream, chunk: Buffer, watch: (text: string) => void): void {
    target.write(chunk);
    watch(chunk.toString(Resources.textEncoding));
  }

  private static signal(processId: number, signal: NodeJS.Signals | 0): boolean {
    try {
      process.kill(processId, signal);
      return true;
    }
    catch (error) {
      if (error instanceof Error && Resources.errorCodeField in error && error[Resources.errorCodeField] === Resources.missingProcessCode)
        return false;
      throw error;
    }
  }
}
