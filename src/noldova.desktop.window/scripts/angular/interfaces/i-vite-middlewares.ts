/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export interface IViteMiddlewares {
  use(handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void): void;
}
