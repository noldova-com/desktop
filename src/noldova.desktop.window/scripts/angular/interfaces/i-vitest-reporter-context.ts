/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IVitestReporterRun } from "./i-vitest-reporter-run.ts";

export interface IVitestReporterContext {
  readonly vitest: IVitestReporterRun;
}
