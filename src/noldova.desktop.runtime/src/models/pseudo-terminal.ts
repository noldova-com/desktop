/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants } from "node:os";

import "@noldova/context.core";

import type { IPseudoTerminalExit } from "../interfaces/i-pseudo-terminal-exit.js";
import type { IPseudoTerminalHandle } from "../interfaces/i-pseudo-terminal-handle.js";
import { ProcessSignals } from "../services/process/process-signals.js";
import { PseudoTerminalExit } from "./pseudo-terminal-exit.js";
import { Registration } from "./registration.js";
import { TerminalSize } from "./terminal-size.js";

export class PseudoTerminal {
  private readonly handle: IPseudoTerminalHandle;
  private readonly stop: (terminal: PseudoTerminal) => Promise<boolean>;
  private readonly readForegroundGroupAsync: (processId: number, started: Date) => Promise<number | null>;
  private readonly listeners: Set<(text: string) => void> = new Set();
  private readonly early: string[] = [];
  private hasListened: boolean = false;
  private hasExitedValue: boolean = false;
  private stopping: Promise<boolean> | null = null;

  public readonly program: string;
  public readonly started: Date;
  public readonly exited: Promise<PseudoTerminalExit>;

  public constructor(handle: IPseudoTerminalHandle, program: string, started: Date, stop: (terminal: PseudoTerminal) => Promise<boolean>,
    readForegroundGroupAsync: (processId: number, started: Date) => Promise<number | null> = async () => null) {
    this.handle = handle;
    this.stop = stop;
    this.readForegroundGroupAsync = readForegroundGroupAsync;
    this.program = program;
    this.started = started;
    handle.onData(t => this.receive(t));
    this.exited = new Promise<PseudoTerminalExit>(resolve => handle.onExit(t => {
      this.hasExitedValue = true;
      resolve(PseudoTerminal.toExit(t));
    }));
  }

  public get processId(): number {
    return this.handle.pid;
  }

  public get hasExited(): boolean {
    return this.hasExitedValue;
  }

  public onOutput(listener: (text: string) => void): Registration {
    const entry = (text: string): void => listener(text);
    this.listeners.add(entry);
    if (!this.hasListened) {
      this.hasListened = true;
      for (const text of this.early.splice(0))
        entry(text);
    }
    return new Registration(() => this.listeners.delete(entry));
  }

  public write(text: string): void {
    if (!this.hasExitedValue)
      this.unlessEnded(() => this.handle.write(text));
  }

  public resize(columns: number, rows: number): void {
    TerminalSize.check(columns, rows);
    if (!this.hasExitedValue)
      this.unlessEnded(() => this.handle.resize(columns, rows));
  }

  public pause(): void {
    this.handle.pause();
  }

  public resume(): void {
    this.handle.resume();
  }

  public async readForegroundProcessGroupAsync(): Promise<number | null> {
    const group = this.hasExitedValue ? null : await this.readForegroundGroupAsync(this.handle.pid, this.started);
    return this.hasExitedValue ? null : group;
  }

  public stopAsync(): Promise<boolean> {
    this.stopping ??= this.stop(this);
    return this.stopping;
  }

  private unlessEnded(action: () => void): void {
    try {
      action();
    }
    catch (error) {
      if (ProcessSignals.isRunning(this.handle.pid))
        throw error;
    }
  }

  private receive(text: string): void {
    if (!this.hasListened) {
      this.early.push(text);
      return;
    }
    for (const listener of [...this.listeners])
      listener(text);
  }

  private static isSignal(name: string): name is NodeJS.Signals {
    return Object.hasOwn(constants.signals, name);
  }

  private static toExit(exit: IPseudoTerminalExit): PseudoTerminalExit {
    const signal = Object.entries(constants.signals).find(([, number]) => number === exit.signal)?.[0];
    if (!Object.isUndefined(signal) && PseudoTerminal.isSignal(signal))
      return new PseudoTerminalExit(null, signal);
    return new PseudoTerminalExit(Number.isInteger(exit.exitCode) ? Number(exit.exitCode) : null, null);
  }
}
