/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IVitestErrorLogger } from "./i-vitest-error-logger.ts";
import type { IVitestReporterConfig } from "./i-vitest-reporter-config.ts";

export interface IVitestReporterRun {
  readonly config: IVitestReporterConfig;
  readonly logger: IVitestErrorLogger;
}
