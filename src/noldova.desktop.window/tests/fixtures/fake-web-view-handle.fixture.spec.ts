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

import { FakeMember } from "../models/fake-member";
import { FakeMembersFixture } from "./fake-members.fixture";
import { FakeWebViewHandle } from "./fake-web-view-handle.fixture";

const LOAD_LAYER = (): Promise<Type<unknown>> => Promise.reject(new Error("Not loaded."));

const MEMBERS: Readonly<Record<keyof IWebViewHandle, FakeMember<IWebViewHandle>>> = {
  mount: FakeMember.told(t => t.mount(document.createElement("div"))),
  show: FakeMember.told(t => t.show()),
  hide: FakeMember.told(t => t.hide()),
  navigateAsync: FakeMember.answered(t => t.navigateAsync("https://example.com")),
  goBackAsync: FakeMember.answered(t => t.goBackAsync()),
  goForwardAsync: FakeMember.answered(t => t.goForwardAsync()),
  reloadAsync: FakeMember.answered(t => t.reloadAsync()),
  stopAsync: FakeMember.answered(t => t.stopAsync()),
  getZoomAsync: FakeMember.answered(t => t.getZoomAsync()),
  setZoomAsync: FakeMember.answered(t => t.setZoomAsync(1.5)),
  zoomInAsync: FakeMember.answered(t => t.zoomInAsync()),
  zoomOutAsync: FakeMember.answered(t => t.zoomOutAsync()),
  findAsync: FakeMember.answered(t => t.findAsync("plan")),
  findNextAsync: FakeMember.answered(t => t.findNextAsync()),
  findPreviousAsync: FakeMember.answered(t => t.findPreviousAsync()),
  endFind: FakeMember.told(t => t.endFind()),
  subscribe: FakeMember.listened(t => t.subscribe(() => undefined)),
  close: FakeMember.told(t => t.close()),
  id: FakeMember.property(t => t.id),
  pane: FakeMember.property(t => t.pane),
  profileKey: FakeMember.property(t => t.profileKey),
  isClosed: FakeMember.property(t => t.isClosed),
  openLayerAsync: FakeMember.answered(t => t.openLayerAsync(LOAD_LAYER))
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
