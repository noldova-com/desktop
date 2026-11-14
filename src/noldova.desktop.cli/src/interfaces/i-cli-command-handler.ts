/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

import type { CliCommandResult } from "../models/cli-command-result.js";
import type { ICliCommandConsole } from "./i-cli-command-console.js";

export interface ICliCommandHandler {
  handleAsync(values: Readonly<Record<string, JsonValue>>, signal: AbortSignal, console: ICliCommandConsole): Promise<CliCommandResult>;
}
