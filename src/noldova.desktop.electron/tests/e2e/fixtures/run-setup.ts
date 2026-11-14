/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FullConfig } from "@playwright/test";

import { RunRecords } from "./run-records.ts";

export default (config: FullConfig): Promise<void> => RunRecords.setUpAsync(config);
