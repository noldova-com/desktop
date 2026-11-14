/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { WebViewEvent } from "./web-view-event.js";

export class WebViewEvents {
  private static readonly FIELDS: readonly string[] = [Resources.eventsField];

  public readonly events: readonly WebViewEvent[];

  public constructor(events: readonly WebViewEvent[]) {
    if (events.length === 0)
      throw new ArgumentException(Resources.webViewEventsEmpty, Resources.eventsField);

    this.events = [...events];
  }

  public static fromJson(value: unknown, path?: string): WebViewEvents {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewEvents.FIELDS);
    return WireContract.create(reader, () => new WebViewEvents(reader.readObjectArray(Resources.eventsField).map(t => WebViewEvent.fromJson(t.toJson(), t.path))));
  }

  public toJson(): JsonObject {
    return { [Resources.eventsField]: this.events.map(t => t.toJson()) };
  }
}
