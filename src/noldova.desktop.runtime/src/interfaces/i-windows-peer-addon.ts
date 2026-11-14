/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IWindowsPeerAddon {
  findTcpOwner(remotePort: number, localPort: number): unknown;
  openProcess(processId: number, access: number): unknown;
  readCreationTime(handle: bigint): unknown;
  readImagePath(handle: bigint): unknown;
  readEnvironment(handle: bigint): unknown;
  closeHandle(handle: bigint): unknown;
}
