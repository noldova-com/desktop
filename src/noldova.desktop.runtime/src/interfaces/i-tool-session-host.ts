/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import type { ToolDescriptor } from "../models/tool-descriptor.js";
import type { ToolFailure } from "../models/tool-failure.js";
import type { ToolResult } from "../models/tool-result.js";
import type { ToolSession } from "../models/tool-session.js";
import type { IToolCallOptions } from "./i-tool-call-options.js";

export interface IToolSessionHost {
  listTools(): readonly ToolDescriptor[];

  callAsync(session: ToolSession, name: string, input: JsonObject, options: IToolCallOptions): Promise<ToolResult | ToolFailure>;

  end(session: ToolSession): void;
}
