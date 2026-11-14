/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";

import "@noldova/context.core";
import type { IPseudoTerminalHandle, IPseudoTerminalLibrary, IPseudoTerminalOptions } from "@noldova/desktop.runtime";

import { ChildTerminalFixture } from "./child-terminal.fixture.js";

export class PseudoTerminalLibraryFixture implements IPseudoTerminalLibrary {
  private readonly failure: Error | null;

  public readonly started: string[] = [];
  public readonly options: IPseudoTerminalOptions[] = [];
  public readonly calls: string[] = [];
  public readonly terminals: ChildTerminalFixture[] = [];
  public holdsExits: boolean = false;
  public detaches: boolean = process.platform !== "win32";

  public constructor(failure: Error | null = null) {
    this.failure = failure;
  }

  public spawn(file: string, args: string[], options: IPseudoTerminalOptions): IPseudoTerminalHandle {
    if (!Object.isNull(this.failure))
      throw this.failure;
    this.started.push([file, ...args].join(" "));
    this.options.push(options);
    const child = spawn(file, args, { cwd: options.cwd, env: options.env, stdio: "pipe", detached: this.detaches, windowsHide: true });
    const terminal = new ChildTerminalFixture(child, this.calls, this.holdsExits);
    this.terminals.push(terminal);
    return terminal;
  }
}
