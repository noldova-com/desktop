/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { constants } from "node:os";

import "@noldova/context.core";
import type { IPseudoTerminalExit, IPseudoTerminalHandle, IPseudoTerminalSubscription } from "@noldova/desktop.runtime";

import { PseudoTerminalHandleFixture } from "./pseudo-terminal-handle.fixture.js";

export class ChildTerminalFixture implements IPseudoTerminalHandle {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly calls: string[];
  private readonly holdsExit: boolean;
  private readonly held: (() => void)[] = [];

  public readonly pid: number;

  public constructor(child: ChildProcessWithoutNullStreams, calls: string[], holdsExit: boolean = false) {
    this.child = child;
    this.calls = calls;
    this.holdsExit = holdsExit;
    this.pid = child.pid ?? 0;
    child.stdout.setEncoding("utf8");
    child.on("error", () => undefined);
    child.stdin.on("error", () => undefined);
    PseudoTerminalHandleFixture.addWorker(this, () => calls.push("terminate"));
    PseudoTerminalHandleFixture.addSocket(this, { destroy: () => calls.push("destroy") });
  }

  public releaseExit(): void {
    for (const report of this.held.splice(0))
      report();
  }

  public onData(listener: (data: string) => void): IPseudoTerminalSubscription {
    this.child.stdout.on("data", listener);
    return { dispose: () => this.child.stdout.off("data", listener) };
  }

  public onExit(listener: (exit: IPseudoTerminalExit) => void): IPseudoTerminalSubscription {
    const exited = (code: number | null, signal: NodeJS.Signals | null): void => {
      const report = (): void => listener({ exitCode: code ?? 0, signal: Object.isNull(signal) ? 0 : constants.signals[signal] });
      if (this.holdsExit)
        this.held.push(report);
      else
        report();
    };
    this.child.once("exit", exited);
    return { dispose: () => this.child.off("exit", exited) };
  }

  public write(data: string): void {
    this.child.stdin.write(data);
  }

  public resize(columns: number, rows: number): void {
    this.calls.push(`resize ${columns}x${rows}`);
  }

  public pause(): void {
    this.calls.push("pause");
    this.child.stdout.pause();
  }

  public resume(): void {
    this.calls.push("resume");
    this.child.stdout.resume();
  }

  public kill(signal?: string): void {
    this.calls.push(Object.isUndefined(signal) ? "kill" : `kill ${signal}`);
    if (process.platform === "win32")
      this.child.kill();
    else
      this.child.kill(Object.entries(constants.signals).find(t => t[0] === (signal ?? "SIGHUP"))?.[1]);
  }
}
