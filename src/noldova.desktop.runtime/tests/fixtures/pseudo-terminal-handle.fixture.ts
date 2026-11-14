/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IPseudoTerminalExit, IPseudoTerminalHandle, IPseudoTerminalSubscription } from "@noldova/desktop.runtime";

export class PseudoTerminalHandleFixture implements IPseudoTerminalHandle {
  private static readonly WORKER_PATH: readonly string[] = ["_agent", "_conoutSocketWorker", "_worker"];
  private static readonly SOCKET: string = "_socket";

  private readonly dataListeners: Set<(data: string) => void> = new Set();
  private readonly exitListeners: Set<(exit: IPseudoTerminalExit) => void> = new Set();

  public readonly calls: string[] = [];
  public pid: number;
  public killFailure: Error | null = null;
  public failure: Error | null = null;

  public constructor(pid: number = 4_210) {
    this.pid = pid;
  }

  public static addWorker(handle: object, terminate: () => unknown): void {
    let target: object = { terminate };
    for (const name of [...PseudoTerminalHandleFixture.WORKER_PATH].reverse())
      target = Object.fromEntries([[name, target]]);
    Object.assign(handle, target);
  }

  public static addSocket(handle: object, socket: unknown): void {
    Object.assign(handle, Object.fromEntries([[PseudoTerminalHandleFixture.SOCKET, socket]]));
  }

  public get listenerCount(): number {
    return this.dataListeners.size + this.exitListeners.size;
  }

  public emit(data: string): void {
    for (const listener of [...this.dataListeners])
      listener(data);
  }

  public exit(exit: IPseudoTerminalExit): void {
    for (const listener of [...this.exitListeners])
      listener(exit);
  }

  public onData(listener: (data: string) => void): IPseudoTerminalSubscription {
    this.dataListeners.add(listener);
    return { dispose: () => this.dataListeners.delete(listener) };
  }

  public onExit(listener: (exit: IPseudoTerminalExit) => void): IPseudoTerminalSubscription {
    this.exitListeners.add(listener);
    return { dispose: () => this.exitListeners.delete(listener) };
  }

  public write(data: string): void {
    this.calls.push(`write ${data}`);
    this.fail();
  }

  public resize(columns: number, rows: number): void {
    this.calls.push(`resize ${columns}x${rows}`);
    this.fail();
  }

  public pause(): void {
    this.calls.push("pause");
  }

  public resume(): void {
    this.calls.push("resume");
  }

  public kill(signal?: string): void {
    this.calls.push(Object.isUndefined(signal) ? "kill" : `kill ${signal}`);
    if (!Object.isNull(this.killFailure))
      throw this.killFailure;
  }

  private fail(): void {
    if (!Object.isNull(this.failure))
      throw this.failure;
  }
}
