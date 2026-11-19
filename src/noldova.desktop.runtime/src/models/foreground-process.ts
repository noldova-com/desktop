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
  public readonly terminalProgram: string;

  public constructor(group: number, program: string | null, terminalProgram: string) {
    this.group = group;
    this.program = program;
    this.terminalProgram = terminalProgram;
  }

  public get isTerminalProgram(): boolean {
    return this.program === this.terminalProgram;
  }
}
