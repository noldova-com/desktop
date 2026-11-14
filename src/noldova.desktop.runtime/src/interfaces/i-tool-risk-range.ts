/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ToolRisk } from "../enums/tool-risk.js";

export interface IToolRiskRange {
  readonly default: ToolRisk;
  readonly maximum: ToolRisk;
}
