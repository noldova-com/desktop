/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class RequestContext {
  public readonly client: string;
  public readonly payload: JsonValue;
  public readonly signal: AbortSignal;
  public readonly connection: number;
  public readonly window: number | null;
  public readonly page: number | null;

  public constructor(client: string, payload: JsonValue, signal: AbortSignal, connection: number, window: number | null = null, page: number | null = null) {
    ArgumentException.throwIfNullOrWhitespace(client, Resources.clientParameterName);

    this.client = client;
    this.connection = connection;
    this.window = window;
    this.page = page;
    this.payload = payload;
    this.signal = signal;
  }
}
