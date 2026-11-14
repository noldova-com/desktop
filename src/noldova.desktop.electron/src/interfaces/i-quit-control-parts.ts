/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { MainProcessPhase } from "../models/main-process-phase.js";
import type { WindowRegistry } from "../models/window-registry.js";
import type { RuntimeCaller } from "../services/runtime-caller.js";
import type { RuntimeStartup } from "../services/runtime-startup.js";
import type { IQuitHost } from "./i-quit-host.js";

export interface IQuitControlParts extends Pick<IQuitHost, "keepsRunningWithoutWindows" | "findPromptAsync" | "quit" | "exit"> {
  readonly startup: RuntimeStartup;
  readonly runtime: RuntimeCaller;
  readonly phase: MainProcessPhase;
  readonly windows: WindowRegistry;

  whenRestartedAsync(): Promise<void>;
}
