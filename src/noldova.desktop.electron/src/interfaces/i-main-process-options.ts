/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DataDirectory, Installation, ProcessPresence } from "@noldova/desktop.runtime";

import type { MainProcessSettings } from "../models/main-process-settings.js";
import type { TaskbarIdentity } from "../models/taskbar-identity.js";
import type { AppIcons } from "../services/app-icons.js";
import type { MainProcessLog } from "../services/main-process-log.js";
import type { PathCommand } from "../services/path-command.js";
import type { RestartArguments } from "../services/restart-arguments.js";
import type { SpellChecker } from "../services/spell-checker.js";
import type { UpdateTargetConnector } from "../services/update-target-connector.js";
import type { ICreatedUpdater } from "./i-created-updater.js";
import type { IDeviceFileStore } from "./i-device-file-store.js";
import type { IElectron } from "./i-electron.js";
import type { IMainProcessEnvironment } from "./i-main-process-environment.js";
import type { IRuntimeLauncher } from "./i-runtime-launcher.js";
import type { IUpdateCheckLock } from "./i-update-check-lock.js";

export interface IMainProcessOptions {
  readonly electron: IElectron;
  readonly process: IMainProcessEnvironment;
  readonly argv: readonly string[];
  readonly restartArguments: RestartArguments;
  readonly settings: MainProcessSettings;
  readonly taskbar: TaskbarIdentity;
  readonly dataDirectory: DataDirectory;
  readonly deviceFolder: string;
  readonly isPackaged: boolean;
  readonly log: MainProcessLog;
  readonly launcher: IRuntimeLauncher;
  readonly icons: AppIcons;
  readonly spelling: SpellChecker;
  readonly installation: Installation;
  readonly presence: Pick<ProcessPresence, "stampAsync" | "isRunningAsync">;
  readonly connector: UpdateTargetConnector;
  readonly updater: ICreatedUpdater;
  readonly updateLock: IUpdateCheckLock;

  readDeviceAsync(folder: string): Promise<string>;
  createDeviceFile(folder: string, fileName: string): IDeviceFileStore;
  createPathCommand(executablePath: string): PathCommand;
  recordMainProcessAsync(): Promise<boolean>;
}
