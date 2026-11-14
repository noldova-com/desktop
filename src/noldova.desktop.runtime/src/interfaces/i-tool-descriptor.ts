/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { IToolDeadline } from "./i-tool-deadline.js";
import type { IToolHints } from "./i-tool-hints.js";
import type { IToolLimits } from "./i-tool-limits.js";
import type { IToolRiskRange } from "./i-tool-risk-range.js";

export interface IToolDescriptor {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: JsonObject;
  readonly outputSchema?: JsonObject;
  readonly hints?: IToolHints;
  readonly risk: IToolRiskRange;
  readonly isResumable?: boolean;
  readonly marksSending?: boolean;
  readonly deadline: IToolDeadline;
  readonly resource?: string;
  readonly limits?: IToolLimits;
  readonly nextTool?: string;
}
