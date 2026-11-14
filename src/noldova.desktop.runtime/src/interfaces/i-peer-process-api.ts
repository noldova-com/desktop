/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Socket } from "node:net";

import type { PeerProcess } from "../models/peer-process.js";

export interface IPeerProcessApi {
  readAsync(socket: Socket): Promise<PeerProcess | null>;
  readSender(socket: Socket): string | null;
}
