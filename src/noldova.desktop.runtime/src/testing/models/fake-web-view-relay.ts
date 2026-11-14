/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IWebViewRelay } from "../../interfaces/i-web-view-relay.js";
import type { WebViewProtocolEvent } from "../../models/web-view-protocol-event.js";

export class FakeWebViewRelay extends Fake<IWebViewRelay> implements IWebViewRelay {
  private readonly protocolEvents: Set<{ readonly id: string; readonly listener: (event: WebViewProtocolEvent) => void }> = new Set<{ readonly id: string; readonly listener: (event: WebViewProtocolEvent) => void }>();

  public readonly sendAsync: IWebViewRelay["sendAsync"] = (...args) => this.respondAsync("sendAsync", args, this.answers.sendAsync);
  public readonly onProtocolEvent: IWebViewRelay["onProtocolEvent"] = (id, listener) => this.listen("onProtocolEvent", [id, listener], this.protocolEvents, { id, listener });

  public raiseProtocolEvent(id: string, event: WebViewProtocolEvent): void {
    this.raiseIsolated(this.protocolEvents, t => t.id === id && t.listener(event));
  }
}
