/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

import type { AgentController } from "../services/agent-controller.js";
import type { DeviceSettingFollower } from "../services/device-setting-follower.js";
import type { QuitCoordinator } from "../services/quit-coordinator.js";
import type { SecretAnswerer } from "../services/secret-answerer.js";
import type { SystemNotifier } from "../services/system-notifier.js";
import type { TrayController } from "../services/tray-controller.js";

export interface IRuntimeEventOwners {
  readonly notifier: SystemNotifier;
  readonly tray: TrayController;
  readonly quit: QuitCoordinator;
  readonly agents: AgentController;
  readonly secrets: SecretAnswerer;
  readonly trayIcon: DeviceSettingFollower;
  readonly keyBindings: DeviceSettingFollower;
  readonly updateChecks: DeviceSettingFollower;

  answerWebView(payload: JsonValue): void;
  quitForRuntime(): void;
}
