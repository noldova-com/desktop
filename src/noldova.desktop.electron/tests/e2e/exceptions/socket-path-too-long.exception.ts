/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class SocketPathTooLongException extends ElectronException {
  public readonly socketPath: string;
  public readonly length: number;
  public readonly maximum: number;

  public constructor(socketPath: string, length: number, maximum: number) {
    super(`A test of this run would start the runtime with the socket path ${socketPath}, which is ${length} bytes, over the ${maximum} the runtime accepts, so the run stops before its tests; run it from a shorter temporary folder.`);

    this.socketPath = socketPath;
    this.length = length;
    this.maximum = maximum;
  }
}
