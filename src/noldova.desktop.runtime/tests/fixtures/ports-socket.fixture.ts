/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Socket } from "node:net";

export class PortsSocketFixture extends Socket {
  public override readonly remotePort: number | undefined;

  public constructor(remotePort: number | undefined) {
    super();
    this.remotePort = remotePort;
  }
}
