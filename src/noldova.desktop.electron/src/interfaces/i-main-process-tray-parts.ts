/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KnownDevice } from "../models/known-device.js";
import type { WindowRegistry } from "../models/window-registry.js";
import type { DeviceState } from "../services/device-state.js";
import type { RuntimeCaller } from "../services/runtime-caller.js";
import type { SystemNotifier } from "../services/system-notifier.js";
import type { ITrayActions } from "./i-tray-actions.js";

export interface IMainProcessTrayParts extends Omit<ITrayActions, "setDoNotDisturb"> {
  readonly deviceState: DeviceState;
  readonly windows: WindowRegistry;
  readonly runtime: RuntimeCaller;
  readonly device: KnownDevice;
  readonly notifier: SystemNotifier;

  followTrayIcon(isShown: boolean): void;
}
