/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ComponentRef } from "@angular/core";

import type { TabContentComponent } from "../../../src/app/components/tab-content/tab-content.component";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { LiveView } from "../../../src/app/models/live-view";
import { DomFixture } from "../../fixtures/dom.fixture";

describe("LiveView", () => {
  let element: HTMLElement;
  let first: HTMLElement;
  let second: HTMLElement;
  let outside: HTMLButtonElement;
  let view: LiveView;

  function createElement(): HTMLElement {
    const created = document.createElement("div");
    created.innerHTML = "<textarea></textarea><div class=\"list\"><div class=\"rows\"></div></div><div class=\"rows\"></div>";
    created.style.cssText = "display: block; height: 100px; overflow: auto";
    DomFixture.one(created, ".list").style.cssText = "height: 50px; overflow: auto";
    for (const rows of created.querySelectorAll<HTMLElement>(".rows"))
      rows.style.cssText = "height: 400px";
    return created;
  }

  function createView(root: HTMLElement): LiveView {
    return new LiveView(new ViewTab("notes.list"), { instance: { element: root } } as ComponentRef<TabContentComponent>);
  }

  function scroll(target: Element, top: number): void {
    target.scrollTop = top;
    target.dispatchEvent(new Event("scroll"));
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "setTimeout", "clearTimeout"] });
    element = createElement();
    first = document.createElement("div");
    second = document.createElement("div");
    outside = document.createElement("button");
    document.body.append(first, second, outside);
    view = createView(element);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    first.remove();
    second.remove();
    outside.remove();
  });

  it("moves into a slot and out of it, keeping the scroll positions of itself and the elements inside it and the focus inside it", () => {
    const field = DomFixture.oneOf(element, "textarea", HTMLTextAreaElement);
    const list = DomFixture.one(element, ".list");
    view.enter(first);
    field.focus();
    scroll(element, 80);
    scroll(list, 120);
    const entered = view.slot;

    view.leave();
    const left = [view.slot, element.isConnected, document.activeElement];
    view.enter(second);
    view.restore();

    expect([entered, ...left]).toEqual([first, null, false, document.body]);
    expect([view.slot, element.parentElement, element.scrollTop, list.scrollTop, document.activeElement]).toEqual([second, second, 80, 120, field]);
  });

  it("keeps the scroll positions it read before the page took it out ahead of its slot, in the same frame as the scroll", () => {
    view.enter(first);
    scroll(element, 80);
    view.readScrollOffsets();

    first.remove();
    view.leave();
    view.enter(second);
    view.restore();

    expect(element.scrollTop).toBe(80);
  });

  it("ignores a scroll reported while it is out of the page or between moving to a slot and being restored there", () => {
    const list = DomFixture.one(element, ".list");
    view.enter(first);
    scroll(element, 80);
    scroll(list, 120);

    view.leave();
    element.dispatchEvent(new Event("scroll"));
    view.enter(second);
    list.dispatchEvent(new Event("scroll", { bubbles: true }));
    view.restore();
    const restored = [element.scrollTop, list.scrollTop];
    second.remove();
    element.dispatchEvent(new Event("scroll"));
    view.leave();
    view.enter(first);
    view.restore();

    expect([...restored, element.scrollTop, list.scrollTop]).toEqual([80, 120, 80, 120]);
  });

  it("forgets the scroll position of an element that has left it and ignores a scroll that comes from no element", () => {
    const list = DomFixture.one(element, ".list");
    view.enter(first);
    scroll(list, 120);
    view.readScrollOffsets();
    element.append(document.createTextNode("end"));
    element.lastChild?.dispatchEvent(new Event("scroll", { bubbles: true }));
    list.remove();
    list.scrollTop = 0;

    view.restore();
    element.append(list);
    view.restore();

    expect(list.scrollTop).toBe(0);
  });

  it("reads no scroll position during a scroll event, but each scrolled element's once after the frame is drawn and once more when it leaves", () => {
    const list = DomFixture.one(element, ".list");
    view.enter(first);
    const reads = vi.spyOn(Element.prototype, "scrollTop", "get");
    for (let index = 1; index <= 5; index++) {
      scroll(element, index * 10);
      scroll(list, index * 20);
    }
    const during = reads.mock.calls.length;
    vi.runAllTimers();
    const drawn = reads.mock.calls.length;
    scroll(element, 70);
    scroll(list, 130);
    view.leave();
    const left = reads.mock.calls.length;
    vi.runAllTimers();
    const after = reads.mock.calls.length;
    reads.mockRestore();
    view.enter(second);
    view.restore();

    expect([during, drawn, left, after]).toEqual([0, 2, 4, 4]);
    expect([element.scrollTop, list.scrollTop]).toEqual([70, 130]);
  });

  it("drops the scroll positions it hasn't read yet when the page takes it out before the frame is drawn, and keeps the ones it read before", () => {
    const list = DomFixture.one(element, ".list");
    view.enter(first);
    scroll(element, 80);
    vi.runAllTimers();
    scroll(element, 90);
    scroll(list, 120);

    first.remove();
    vi.runAllTimers();
    view.leave();
    view.enter(second);
    view.restore();

    expect([element.scrollTop, list.scrollTop]).toEqual([80, 0]);
  });

  it("runs none of its queued reads once it is disposed, whether the read waits for the frame or for the frame to be drawn", () => {
    view.enter(first);
    const reads = vi.spyOn(view, "readScrollOffsets");
    element.dispatchEvent(new Event("scroll"));
    view.dispose();
    vi.runAllTimers();
    const waitingForFrame = reads.mock.calls.length;
    element.dispatchEvent(new Event("scroll"));
    requestAnimationFrame(() => view.dispose());
    vi.runAllTimers();
    const waitingForDrawing = reads.mock.calls.length;
    reads.mockRestore();

    expect([waitingForFrame, waitingForDrawing]).toEqual([0, 0]);
  });

  it("leaves the focus where the person moved it while the view was out of its slot", () => {
    view.enter(first);
    DomFixture.oneOf(element, "textarea", HTMLTextAreaElement).focus();
    view.leave();
    outside.focus();

    view.enter(first);
    view.restore();

    expect(document.activeElement).toBe(outside);
  });

  it("never focuses an element that is no longer in the page or no longer in the view", () => {
    const field = DomFixture.oneOf(element, "textarea", HTMLTextAreaElement);
    view.enter(first);
    field.focus();
    view.leave();
    view.restore();
    const whileOut = document.activeElement;
    view.enter(first);
    field.focus();
    view.leave();
    field.remove();
    view.enter(first);

    view.restore();

    expect([whileOut, document.activeElement]).toEqual([document.body, document.body]);
  });

  it("moves no focus when none was inside it", () => {
    view.enter(first);
    outside.focus();
    view.leave();
    outside.blur();

    view.enter(first);
    view.restore();

    expect(document.activeElement).toBe(document.body);
  });

  it("conceals itself in its slot, inert, and shows its scroll and focus again once revealed there", () => {
    const field = DomFixture.oneOf(element, "textarea", HTMLTextAreaElement);
    const list = DomFixture.one(element, ".list");
    view.enter(first);
    field.focus();
    scroll(element, 80);
    scroll(list, 120);

    view.conceal();
    const concealed = [view.isConcealed, view.slot, element.parentElement, element.inert, element.classList.contains("nol-tab-content-concealed")];
    field.blur();
    view.reveal();
    view.restore();

    expect(concealed).toEqual([true, first, first, true, true]);
    expect([view.isConcealed, element.parentElement, element.inert, element.classList.contains("nol-tab-content-concealed")]).toEqual([false, first, false, false]);
    expect([element.scrollTop, list.scrollTop, document.activeElement]).toEqual([80, 120, field]);
  });

  it("keeps the place it had when it was concealed, not the one it has when it leaves, and comes into its next slot in sight", () => {
    const field = DomFixture.oneOf(element, "textarea", HTMLTextAreaElement);
    view.enter(first);
    field.focus();
    scroll(element, 80);
    view.conceal();
    field.blur();
    scroll(element, 10);
    vi.runAllTimers();

    view.leave();
    const left = [view.slot, view.isConcealed, element.isConnected, element.inert, element.classList.contains("nol-tab-content-concealed")];
    view.enter(second);
    view.restore();

    expect(left).toEqual([null, false, false, false, false]);
    expect([element.parentElement, element.scrollTop, document.activeElement]).toEqual([second, 80, field]);
  });

  it("listens for scrolls passively, on its own element only", () => {
    const root = createElement();
    const listen = vi.spyOn(EventTarget.prototype, "addEventListener");

    createView(root);
    const calls = listen.mock.calls.map(t => [t[0], t[1] instanceof Function, t[2]]);
    const contexts = [...listen.mock.contexts];
    listen.mockRestore();

    expect(calls).toEqual([["scroll", true, { capture: true, passive: true }]]);
    expect(contexts).toEqual([root]);
  });
});
