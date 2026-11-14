/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KnownDevice } from "../models/known-device.js";
import type { MainProcessPhase } from "../models/main-process-phase.js";
import type { WindowRegistry } from "../models/window-registry.js";
import type { DeviceState } from "../services/device-state.js";
import type { RuntimeCaller } from "../services/runtime-caller.js";
import type { RuntimeStartup } from "../services/runtime-startup.js";
import type { TrayController } from "../services/tray-controller.js";
import type { IQuitPrompt } from "./i-quit-prompt.js";
import type { IUpdateHost } from "./i-update-host.js";

export interface IMainProcessUpdateParts {
  readonly host: IUpdateHost;
  readonly startup: RuntimeStartup;
  readonly windows: WindowRegistry;
  readonly phase: MainProcessPhase;
  readonly deviceState: DeviceState;
  readonly tray: TrayController;
  readonly runtime: RuntimeCaller;
  readonly device: KnownDevice;
  readonly launchArguments: readonly string[];
  readonly handoverFolders: readonly string[];

  findPromptAsync(): Promise<IQuitPrompt | null>;
}
