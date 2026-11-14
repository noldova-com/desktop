/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { UpdateStatus } from "../models/update-status.js";
import type { IUpdateSetup } from "./i-update-setup.js";

export interface ICreatedUpdater {
  readonly setup: IUpdateSetup | null;
  readonly status: UpdateStatus;
}
