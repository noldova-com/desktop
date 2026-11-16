/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Socket } from "node:net";

export interface IMainProcessCheck {
  accept?(socket: Socket): void;
  isMainProcessAsync(socket: Socket): Promise<boolean>;
  isSameSender(socket: Socket): boolean;
}
