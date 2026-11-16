/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IBrowserRequest } from "./i-browser-request.ts";

export interface IBrowserResponse {
  url(): string;
  status(): number;
  headers(): Record<string, string>;
  request(): IBrowserRequest;
}
