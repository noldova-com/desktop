/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { InstalledPackage } from "../models/packaging/installed-package.ts";
import type { StartedProcess } from "../services/processes/started-process.ts";
import type { ISmokeCopy } from "./i-smoke-copy.ts";

export interface IKilledCopySession {
  readonly installed: InstalledPackage;
  readonly data: string;
  readonly folder: string;
  readonly startMainProcessAsync: (installed: InstalledPackage, data: string, folder: string, log: string) => Promise<StartedProcess>;
  readonly waitForRuntimeAsync: (installed: InstalledPackage, data: string, folder: string, mainProcess: StartedProcess, logs: readonly string[]) => Promise<string>;
  readonly readRuntimeIdAsync: (data: string) => Promise<number | null>;
  readonly requireCopyAsync: (data: string, runtime: number, mainProcess: StartedProcess, mainLogs: readonly string[]) => Promise<ISmokeCopy>;
  readonly waitForExitAsync: (runtime: number, limit: number) => Promise<boolean>;
  readonly requireCopyEndedAsync: (copy: ISmokeCopy, moment: string, log: string) => Promise<void>;
  readonly track: (runtime: number | null) => void;
}
