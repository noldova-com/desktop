/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPseudoTerminalExit } from "./i-pseudo-terminal-exit.js";
import type { IPseudoTerminalSubscription } from "./i-pseudo-terminal-subscription.js";

export interface IPseudoTerminalHandle {
  readonly pid: number;
  onData(listener: (data: string) => void): IPseudoTerminalSubscription;
  onExit(listener: (exit: IPseudoTerminalExit) => void): IPseudoTerminalSubscription;
  write(data: string): void;
  resize(columns: number, rows: number): void;
  pause(): void;
  resume(): void;
  kill(signal?: string): void;
}
