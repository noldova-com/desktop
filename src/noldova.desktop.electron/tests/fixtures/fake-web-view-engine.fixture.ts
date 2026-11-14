/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IWebViewEngine } from "@noldova/desktop.electron";

import { FakeClock } from "./fake-clock.fixture.js";
import { FakeWebView } from "./fake-web-view.fixture.js";
import { FakeWebViewSession } from "./fake-web-view-session.fixture.js";

export class FakeWebViewEngine implements IWebViewEngine {
  public readonly sessions: Map<string, FakeWebViewSession> = new Map();
  public readonly views: FakeWebView[] = [];
  public prepare: (view: FakeWebView) => void = () => undefined;
  public isAllowed: (windowId: number, partition: string) => boolean = () => false;
  public logRefusal: (text: string) => void = () => undefined;
  public time: number = 1000;
  public readonly clock: FakeClock = new FakeClock();

  public readSession(partition: string): FakeWebViewSession {
    const session = this.sessions.get(partition) ?? new FakeWebViewSession();
    this.sessions.set(partition, session);
    return session;
  }

  public createGuest(hostId: number | null, partition: string | null): FakeWebView {
    const view = new FakeWebView(500 + this.views.length, hostId, partition);
    this.views.push(view);
    this.prepare(view);
    return view;
  }

  public findGuest(contentsId: number): FakeWebView | null {
    const view = this.views.find(t => t.contents.id === contentsId);
    return Object.isUndefined(view) || view.contents.destroyed ? null : view;
  }

  public watchAttach(isAllowed: (windowId: number, partition: string) => boolean, log: (text: string) => void): void {
    this.isAllowed = isAllowed;
    this.logRefusal = log;
  }

  public now(): number {
    return this.time;
  }

  public waitAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    return this.clock.waitAsync(milliseconds, signal);
  }

  public session(partition: string): FakeWebViewSession {
    const session = this.sessions.get(partition);
    if (Object.isUndefined(session))
      throw new Error(`No session for ${partition}.`);
    return session;
  }
}
