/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type PseudoTerminalExit, RuntimeException } from "@noldova/desktop.runtime";

export class ProgramExitedEarlyException extends RuntimeException {
  public readonly exit: PseudoTerminalExit;
  public readonly expected: string;
  public readonly output: string;

  public constructor(exit: PseudoTerminalExit, expected: string, output: string) {
    super(`The program exited with ${exit.code} ${exit.signal} before it printed ${expected}. It printed: ${JSON.stringify(output)}`);

    this.exit = exit;
    this.expected = expected;
    this.output = output;
  }
}
