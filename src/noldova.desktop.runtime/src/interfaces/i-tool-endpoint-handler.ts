/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

import type { ToolSession } from "../models/tool-session.js";

export interface IToolEndpointHandler {
  handleAsync(request: IncomingMessage, response: ServerResponse, session: ToolSession): Promise<void>;
}
