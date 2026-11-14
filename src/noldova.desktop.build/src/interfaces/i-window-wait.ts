/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessResult } from "../models/processes/process-result.ts";
import type { StartedProcess } from "../services/processes/started-process.ts";

export interface IWindowWait {
  readonly limit: number;
  readonly mainProcess: Pick<StartedProcess, "hasExited" | "ending">;
  queryAsync(): Promise<ProcessResult>;
  readTailAsync(): Promise<string>;
  pauseAsync(): Promise<void>;
  now(): number;
}
