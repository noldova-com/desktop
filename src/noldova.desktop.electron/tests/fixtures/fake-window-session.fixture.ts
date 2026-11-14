/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowSession } from "@noldova/desktop.electron";

import { FakeProtocolHost } from "./fake-protocol-host.fixture.js";

export class FakeWindowSession implements IWindowSession {
  public readonly protocol: FakeProtocolHost = new FakeProtocolHost();
}
