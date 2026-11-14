/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IViteMiddlewares } from "./i-vite-middlewares.ts";
import type { IViteServerConfig } from "./i-vite-server-config.ts";

export interface IViteServer {
  readonly middlewares: IViteMiddlewares;
  readonly config: IViteServerConfig;
}
