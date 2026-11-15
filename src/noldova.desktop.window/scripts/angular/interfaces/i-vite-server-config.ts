/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IViteLogger } from "./i-vite-logger.ts";

export interface IViteServerConfig {
  readonly logger: IViteLogger;
}
