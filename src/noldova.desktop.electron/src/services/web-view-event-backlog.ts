/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import { Resources } from "../resources.js";

export class WebViewEventBacklog {
  private readonly limit: number;
  private readonly events: WebViewEvent[] = [];
  private readonly counts: Map<string, number> = new Map();
  private readonly drops: Map<string, WebViewEvent> = new Map();

  public constructor(limit: number) {
    this.limit = limit;
  }

  public push(event: WebViewEvent): void {
    const count = this.counts.get(event.view) ?? 0;
    if (count < this.limit)
      this.counts.set(event.view, count + 1);
    else {
      this.events.splice(this.events.findIndex(t => t.view === event.view), 1);
      const dropped = Number(this.drops.get(event.view)?.details[Resources.countField] ?? 0) + 1;
      this.drops.set(event.view, new WebViewEvent(event.module, event.view, WebViewEventKind.Dropped, { [Resources.countField]: dropped }));
    }
    this.events.push(event);
  }

  public take(): readonly WebViewEvent[] {
    const taken = [...this.drops.values(), ...this.events];
    this.events.length = 0;
    this.counts.clear();
    this.drops.clear();
    return taken;
  }
}
