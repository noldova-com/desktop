/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";

import { WebViewEvent, WebViewEventKind } from "@noldova/desktop.protocol";
import type { IWebViewHandle } from "@noldova/desktop.window";

import type { FakeMember } from "../types/fake-member";
import { FakeMembersFixture } from "./fake-members.fixture";
import { FakeWebViewHandle } from "./fake-web-view-handle.fixture";

const LOAD_LAYER = (): Promise<Type<unknown>> => Promise.reject(new Error("Not loaded."));

const MEMBERS: Readonly<Record<keyof IWebViewHandle, FakeMember<IWebViewHandle>>> = {
  mount: ["told", t => t.mount(document.createElement("div"))],
  show: ["told", t => t.show()],
  hide: ["told", t => t.hide()],
  navigateAsync: ["answered", t => t.navigateAsync("https://example.com")],
  goBackAsync: ["answered", t => t.goBackAsync()],
  goForwardAsync: ["answered", t => t.goForwardAsync()],
  reloadAsync: ["answered", t => t.reloadAsync()],
  stopAsync: ["answered", t => t.stopAsync()],
  getZoomAsync: ["answered", t => t.getZoomAsync()],
  setZoomAsync: ["answered", t => t.setZoomAsync(1.5)],
  zoomInAsync: ["answered", t => t.zoomInAsync()],
  zoomOutAsync: ["answered", t => t.zoomOutAsync()],
  findAsync: ["answered", t => t.findAsync("plan")],
  findNextAsync: ["answered", t => t.findNextAsync()],
  findPreviousAsync: ["answered", t => t.findPreviousAsync()],
  endFind: ["told", t => t.endFind()],
  subscribe: ["listened", t => t.subscribe(() => undefined)],
  close: ["told", t => t.close()],
  id: ["property", t => t.id],
  pane: ["property", t => t.pane],
  profileKey: ["property", t => t.profileKey],
  isClosed: ["property", t => t.isClosed],
  openLayerAsync: ["answered", t => t.openLayerAsync(LOAD_LAYER)]
};

describe("FakeWebViewHandle", () => {
  FakeMembersFixture.check<IWebViewHandle>(() => new FakeWebViewHandle(), MEMBERS);

  it("raises each event to each subscriber, in order, until its disposer runs", () => {
    const handle = new FakeWebViewHandle();
    const heard: string[] = [];
    const stop = handle.subscribe(t => heard.push(`first ${t.kind}`));
    handle.subscribe(t => heard.push(`second ${t.kind}`));
    const event = new WebViewEvent("notes", "view-1", WebViewEventKind.Closed);

    handle.raiseEvent(event);
    stop();
    handle.raiseEvent(event);

    expect(heard).toEqual(["first Closed", "second Closed", "second Closed"]);
  });

  it("still calls a subscriber removed during the raise, and stops at one that throws, as the window's dispatch does", () => {
    const handle = new FakeWebViewHandle();
    const heard: string[] = [];
    const failure = new Error("The subscriber failed.");
    let stopRemoved = (): void => undefined;
    handle.subscribe(() => stopRemoved());
    stopRemoved = handle.subscribe(() => heard.push("removed"));
    handle.subscribe(() => {
      throw failure;
    });
    handle.subscribe(() => heard.push("last"));

    expect(() => handle.raiseEvent(new WebViewEvent("notes", "view-1", WebViewEventKind.Closed))).toThrow(failure);
    expect([heard, handle.errors]).toEqual([["removed"], []]);
  });

  it("calls the answer to openLayerAsync with the caller's type arguments", async () => {
    const handle = new FakeWebViewHandle();
    const load = (): Promise<Type<unknown>> => Promise.reject(new Error("Not loaded."));
    const failure = new Error("No layer.");
    handle.answer("openLayerAsync", () => Promise.reject(failure));

    await expect(handle.openLayerAsync(load)).rejects.toBe(failure);
    expect(handle.callsOf("openLayerAsync")).toEqual([[load]]);
  });
});
