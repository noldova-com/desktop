/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IReportedModule } from "./i-reported-module.ts";
import type { IReportedSuite } from "./i-reported-suite.ts";

export interface IReportedHook {
  readonly name: string;
  readonly entity: IReportedSuite | IReportedModule;
}
