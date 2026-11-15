/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebViewFailure, WebViewFailureKind } from "@noldova/desktop.protocol";
import { Fake } from "@noldova/desktop.protocol/testing";

import { WebViewFailureException } from "../../exceptions/web-view-failure.exception.js";
import type { IWebViewRelay } from "../../interfaces/i-web-view-relay.js";
import type { WebViewProtocolEvent } from "../../models/web-view-protocol-event.js";
import { Resources } from "../../resources.js";

export class FakeWebViewRelay extends Fake<IWebViewRelay> implements IWebViewRelay {
  private readonly protocolEvents: Set<{ readonly id: string; readonly listener: (event: WebViewProtocolEvent) => void }> = new Set<{ readonly id: string; readonly listener: (event: WebViewProtocolEvent) => void }>();

  public readonly sendAsync: IWebViewRelay["sendAsync"] = (...args) => this.respondAsync("sendAsync", args, args[1] === Resources.focusEmulationMethod ? FakeWebViewRelay.refuseFocusEmulationAsync : this.answers.sendAsync);
  public readonly onProtocolEvent: IWebViewRelay["onProtocolEvent"] = (id, listener) => this.listen("onProtocolEvent", [id, listener], this.protocolEvents, { id, listener });

  public raiseProtocolEvent(id: string, event: WebViewProtocolEvent): void {
    this.raiseIsolated(this.protocolEvents, t => t.id === id && t.listener(event));
  }

  private static refuseFocusEmulationAsync(): Promise<never> {
    return Promise.reject(new WebViewFailureException(new WebViewFailure(WebViewFailureKind.NotAllowed, null, Resources.focusEmulationRefused)));
  }
}
