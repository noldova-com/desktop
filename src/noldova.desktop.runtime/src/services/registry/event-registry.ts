/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import { Event, type QualifiedName } from "@noldova/desktop.protocol";

import { EventDeclaredException } from "../../exceptions/event-declared.exception.js";
import { EventWithdrawnException } from "../../exceptions/event-withdrawn.exception.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import { EventChannel } from "../../models/event-channel.js";

export class EventRegistry {
  private readonly names: Set<string> = new Set();
  private readonly sink: IEventSink;

  public constructor(sink: IEventSink) {
    this.sink = sink;
  }

  public declare(name: QualifiedName): EventChannel {
    if (this.names.has(name.text))
      throw new EventDeclaredException(name.text);

    this.names.add(name.text);
    return new EventChannel(
      (payload: JsonValue, connection?: number, window?: number | null) => this.publish(name, payload, connection, window),
      () => this.names.delete(name.text));
  }

  private publish(name: QualifiedName, payload: JsonValue, connection?: number, window?: number | null): void {
    if (!this.names.has(name.text))
      throw new EventWithdrawnException(name.text);
    if (Object.isUndefined(connection))
      this.sink.broadcast(new Event(name, payload));
    else
      this.sink.send(new Event(name, payload, window ?? undefined), connection);
  }
}
