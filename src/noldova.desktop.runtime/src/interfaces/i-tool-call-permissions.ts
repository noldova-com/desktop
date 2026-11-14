/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionOutcome } from "../models/permission-outcome.js";
import type { IPermissionRequest } from "./i-permission-request.js";

export interface IToolCallPermissions {
  requestAsync(request: IPermissionRequest, signal: AbortSignal): Promise<PermissionOutcome>;
}
