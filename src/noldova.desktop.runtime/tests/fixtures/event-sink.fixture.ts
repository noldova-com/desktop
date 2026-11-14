/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Event } from "@noldova/desktop.protocol";
import type { IEventSink } from "@noldova/desktop.runtime";

export class EventSinkFixture implements IEventSink {
  public readonly broadcasts: Event[] = [];
  public readonly sent: (readonly [Event, number])[] = [];

  public broadcast(event: Event): void {
    this.broadcasts.push(event);
  }

  public send(event: Event, connection: number): void {
    this.sent.push([event, connection]);
  }
}
