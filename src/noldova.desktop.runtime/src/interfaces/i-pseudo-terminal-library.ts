/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPseudoTerminalHandle } from "./i-pseudo-terminal-handle.js";
import type { IPseudoTerminalOptions } from "./i-pseudo-terminal-options.js";

export interface IPseudoTerminalLibrary {
  spawn(file: string, args: string[] | string, options: IPseudoTerminalOptions): IPseudoTerminalHandle;
}
