/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event } from "@noldova/desktop.protocol";

export interface IEventSink {
  broadcast(event: Event): void;

  send(event: Event, connection: number): void;
}
