/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, type ChildProcessByStdio, type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import path from "node:path";
import type { Readable, Writable } from "node:stream";

import "@noldova/context.core";

import type { ILineProcess } from "../../interfaces/i-line-process.js";
import type { ILineProcessListener } from "../../interfaces/i-line-process-listener.js";
import { Resources } from "../../resources.js";
import { ProcessSignals } from "../process/process-signals.js";

export class LineProcess implements ILineProcess {
  private readonly child: ChildProcess | null;
  private readonly input: Writable | null;
  private readonly listener: ILineProcessListener;
  private readonly diagnostics: Writable;
  private readonly isGroup: boolean;
  private readonly signalProcess: (processId: number, signal: NodeJS.Signals) => void;
  private readonly name: string;
  private output: string = String.empty;

  public constructor(file: string, launchArguments: readonly string[], environment: Readonly<Record<string, string>>, listener: ILineProcessListener,
    diagnostics: Writable, isGroup: boolean = false, signalProcess: (processId: number, signal: NodeJS.Signals) => void = ProcessSignals.send) {
    const name = path.basename(file);
    const fail = (error: Error): void => listener.onExit(error.message);
    this.listener = listener;
    this.diagnostics = diagnostics;
    this.isGroup = isGroup;
    this.signalProcess = signalProcess;
    this.name = name;
    let child: ChildProcessByStdio<null, Readable, Readable> | ChildProcessWithoutNullStreams;
    try {
      child = LineProcess.spawn(file, launchArguments, environment, isGroup);
    }
    catch (error) {
      this.child = null;
      this.input = null;
      process.nextTick(() => listener.onExit(String(error)));
      return;
    }
    this.child = child;
    this.input = child.stdin;
    child.stdout.setEncoding(Resources.utf8Encoding);
    child.stdout.on(Resources.dataEvent, (text: string) => this.receive(text));
    child.stderr.resume();
    child.stdin?.on(Resources.errorEvent, fail);
    child.on(Resources.errorEvent, fail);
    child.once(Resources.closeEvent, (code: number | null, signal: NodeJS.Signals | null) =>
      listener.onExit(Resources.formatLineProcessExited(name, code ?? signal)));
  }

  public write(line: string): void {
    this.input?.write(`${line}${Resources.lineSeparator}`);
  }

  public kill(): void {
    if (Object.isNull(this.child))
      return;
    if (this.isGroup && !Object.isUndefined(this.child.pid))
      this.endGroup(this.child.pid);
    this.child.kill(Resources.killSignal);
  }

  private static spawn(file: string, launchArguments: readonly string[], environment: Readonly<Record<string, string>>,
    isGroup: boolean): ChildProcessByStdio<null, Readable, Readable> | ChildProcessWithoutNullStreams {
    const options = { cwd: path.dirname(file), env: { ...environment }, windowsHide: true };
    return isGroup
      ? spawn(file, [...launchArguments], { ...options, stdio: [Resources.ignoredOutput, Resources.pipedOutput, Resources.pipedOutput], detached: true })
      : spawn(file, [...launchArguments], { ...options, stdio: Resources.pipedOutput });
  }

  private endGroup(processId: number): void {
    try {
      this.signalProcess(-processId, Resources.killSignal);
    }
    catch (error) {
      this.diagnostics.write(Resources.formatLineProcessGroupUnsignalled(this.name, String(error)));
    }
  }

  private receive(text: string): void {
    const output = `${this.output}${text}`;
    const end = output.lastIndexOf(Resources.lineSeparator) + 1;
    this.output = output.slice(end);
    for (const line of output.slice(0, end).split(Resources.lineSeparator).slice(0, -1))
      this.listener.onLine(line.replace(Resources.carriageReturnPattern, String.empty));
    if (this.output.length > Resources.maximumLineLength)
      this.kill();
  }
}
