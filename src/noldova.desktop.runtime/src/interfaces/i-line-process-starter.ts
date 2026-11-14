/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ILineProcess } from "./i-line-process.js";
import type { ILineProcessListener } from "./i-line-process-listener.js";

export interface ILineProcessStarter {
  start(file: string, launchArguments: readonly string[], environment: Readonly<Record<string, string>>, listener: ILineProcessListener): ILineProcess;

  startGroup(file: string, launchArguments: readonly string[], environment: Readonly<Record<string, string>>, listener: ILineProcessListener): ILineProcess;
}
