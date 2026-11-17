/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WebViewEvent } from "@noldova/desktop.protocol";
import { Fake } from "@noldova/desktop.protocol/testing";

import type { IRuntimeWebViews } from "../../interfaces/i-runtime-web-views.js";
import { FakeWebViewRelay } from "./fake-web-view-relay.js";

export class FakeRuntimeWebViews extends Fake<IRuntimeWebViews> implements IRuntimeWebViews {
  private readonly viewEvents: Set<(event: WebViewEvent) => void> = new Set<(event: WebViewEvent) => void>();

  public readonly relay: FakeWebViewRelay = new FakeWebViewRelay();
  public readonly list: IRuntimeWebViews["list"] = (...args) => this.ask("list", args, this.answers.list);
  public readonly navigateAsync: IRuntimeWebViews["navigateAsync"] = (...args) => this.respondAsync("navigateAsync", args, this.answers.navigateAsync);
  public readonly actAsync: IRuntimeWebViews["actAsync"] = (...args) => this.respondAsync("actAsync", args, this.answers.actAsync);
  public readonly setAllowedOriginsAsync: IRuntimeWebViews["setAllowedOriginsAsync"] = (...args) => this.respondAsync("setAllowedOriginsAsync", args, this.answers.setAllowedOriginsAsync);
  public readonly setControlledAsync: IRuntimeWebViews["setControlledAsync"] = (...args) => this.respondAsync("setControlledAsync", args, this.answers.setControlledAsync);
  public readonly clearProfileAsync: IRuntimeWebViews["clearProfileAsync"] = (...args) => this.respondAsync("clearProfileAsync", args, this.answers.clearProfileAsync);
  public readonly onViewEvent: IRuntimeWebViews["onViewEvent"] = listener => this.listen("onViewEvent", [listener], this.viewEvents, listener);

  public raiseViewEvent(event: WebViewEvent): void {
    this.raiseIsolated(this.viewEvents, t => t(event));
  }

  protected override parts(): readonly Pick<Fake<object>, "beStrict">[] {
    return [this.relay];
  }
}
