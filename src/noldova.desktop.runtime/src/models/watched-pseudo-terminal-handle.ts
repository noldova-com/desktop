/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IPseudoTerminalExit } from "../interfaces/i-pseudo-terminal-exit.js";
import type { IPseudoTerminalHandle } from "../interfaces/i-pseudo-terminal-handle.js";
import type { IPseudoTerminalSubscription } from "../interfaces/i-pseudo-terminal-subscription.js";
import { Resources } from "../resources.js";
import { ProcessSignals } from "../services/process/process-signals.js";

export class WatchedPseudoTerminalHandle implements IPseudoTerminalHandle {
  private readonly handle: IPseudoTerminalHandle;
  private readonly watchMilliseconds: number;
  private readonly reportMilliseconds: number;
  private readonly readExitCodeAsync: () => Promise<number | undefined>;
  private readonly exitListeners: Set<(exit: IPseudoTerminalExit) => void> = new Set();
  private unreported: ((message: string) => void) | undefined;
  private hasExited: boolean = false;
  private watching: NodeJS.Timeout | undefined;
  private reporting: NodeJS.Timeout | undefined;

  public constructor(handle: IPseudoTerminalHandle, watchMilliseconds: number, reportMilliseconds: number, readExitCodeAsync: () => Promise<number | undefined>) {
    this.handle = handle;
    this.watchMilliseconds = watchMilliseconds;
    this.reportMilliseconds = reportMilliseconds;
    this.readExitCodeAsync = readExitCodeAsync;
    handle.onExit(t => this.exitWithCode(t));
  }

  public get pid(): number {
    return this.handle.pid;
  }

  public onData(listener: (data: string) => void): IPseudoTerminalSubscription {
    return this.handle.onData(listener);
  }

  public onExit(listener: (exit: IPseudoTerminalExit) => void): IPseudoTerminalSubscription {
    const entry = (exit: IPseudoTerminalExit): void => listener(exit);
    this.exitListeners.add(entry);
    return { dispose: () => this.exitListeners.delete(entry) };
  }

  public write(data: string): void {
    this.handle.write(data);
  }

  public resize(columns: number, rows: number): void {
    this.handle.resize(columns, rows);
  }

  public pause(): void {
    this.handle.pause();
  }

  public resume(): void {
    this.handle.resume();
  }

  public kill(signal?: string): void {
    this.handle.kill(signal);
  }

  public watch(unreported: (message: string) => void): void {
    this.unreported = unreported;
    this.check(this.watchMilliseconds, unreported);
  }

  public watchClosely(): void {
    if (!Object.isUndefined(this.unreported))
      this.check(Resources.processPollMilliseconds, this.unreported);
  }

  private check(milliseconds: number, unreported: (message: string) => void): void {
    if (this.hasExited || !Object.isUndefined(this.reporting))
      return;
    clearInterval(this.watching);
    this.watching = setInterval(() => this.find(unreported), milliseconds).unref();
  }

  private find(unreported: (message: string) => void): void {
    if (ProcessSignals.isRunning(this.handle.pid))
      return;
    clearInterval(this.watching);
    this.reporting = setTimeout(() => this.giveUp(unreported), this.reportMilliseconds);
  }

  private giveUp(unreported: (message: string) => void): void {
    unreported(Resources.pseudoTerminalExitUnreported);
    this.exit({ exitCode: undefined });
    if (!this.closeOutput())
      unreported(Resources.formatPseudoTerminalMemberMissing(Resources.pseudoTerminalOutputSocket, Resources.pseudoTerminalOutputClose));
  }

  private exit(exit: IPseudoTerminalExit): void {
    if (this.stop())
      this.report(exit);
  }

  private exitWithCode(exit: IPseudoTerminalExit): void {
    if (!this.stop())
      return;
    if (!Object.isUndefined(exit.exitCode)) {
      this.report(exit);
      return;
    }
    void this.readExitCodeAsync().then(t => this.report({ ...exit, exitCode: t }));
  }

  private stop(): boolean {
    if (this.hasExited)
      return false;
    this.hasExited = true;
    clearInterval(this.watching);
    clearTimeout(this.reporting);
    return true;
  }

  private report(exit: IPseudoTerminalExit): void {
    for (const listener of [...this.exitListeners])
      listener(exit);
  }

  private static isClose(value: unknown): value is () => unknown {
    return Object.isFunction(value);
  }

  private closeOutput(): boolean {
    const handle = this.handle;
    const socket: unknown = Resources.pseudoTerminalOutputSocket in handle ? handle[Resources.pseudoTerminalOutputSocket] : undefined;
    const close: unknown = Object.isObject(socket) && Resources.pseudoTerminalOutputClose in socket ? socket[Resources.pseudoTerminalOutputClose] : undefined;
    if (!WatchedPseudoTerminalHandle.isClose(close))
      return false;
    close.call(socket);
    return true;
  }
}
