/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IReportedModule } from "./i-reported-module.ts";

export interface IReportedSuite {
  readonly module: IReportedModule;
}
