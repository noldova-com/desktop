/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IPortBlocker {
  blockPort(port: number): number;
  waitForPortsAsync(serial: number, signal: AbortSignal): Promise<void>;
  unblockPort(port: number): void;
}
