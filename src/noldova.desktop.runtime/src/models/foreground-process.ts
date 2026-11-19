/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class ForegroundProcess {
  public readonly group: number;
  public readonly program: string | null;
  public readonly commandLine: string | null;
  public readonly terminalProgram: string;
  public readonly terminalCommandLine: string;

  public constructor(group: number, program: string | null, commandLine: string | null, terminalProgram: string, terminalCommandLine: string) {
    this.group = group;
    this.program = program;
    this.commandLine = commandLine;
    this.terminalProgram = terminalProgram;
    this.terminalCommandLine = terminalCommandLine;
  }

  public get isTerminalProgram(): boolean {
    return this.program === this.terminalProgram && this.commandLine === this.terminalCommandLine;
  }
}
