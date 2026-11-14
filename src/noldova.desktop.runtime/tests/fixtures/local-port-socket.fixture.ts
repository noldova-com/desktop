/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PortsSocketFixture } from "./ports-socket.fixture.js";

export class LocalPortSocketFixture extends PortsSocketFixture {
  public override readonly localPort: number;

  public constructor(remotePort: number | undefined, localPort: number) {
    super(remotePort);
    this.localPort = localPort;
  }
}
