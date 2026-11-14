/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/context.json";

import type { WebViewProtocolEvent } from "../models/web-view-protocol-event.js";

export interface IWebViewRelay {
  sendAsync(id: string, method: string, params: JsonObject, timeout: number): Promise<JsonValue>;

  onProtocolEvent(id: string, listener: (event: WebViewProtocolEvent) => void): () => void;
}
