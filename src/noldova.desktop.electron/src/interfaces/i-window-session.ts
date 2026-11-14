/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProtocolHost } from "./i-protocol-host.js";

export interface IWindowSession {
  readonly protocol: IProtocolHost;
}
