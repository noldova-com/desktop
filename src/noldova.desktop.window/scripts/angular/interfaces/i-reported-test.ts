/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IReportedSuite } from "./i-reported-suite.ts";

export interface IReportedTest extends IReportedSuite {
  readonly fullName: string;
}
