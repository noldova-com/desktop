/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { DocumentTab } from "../../../src/app/models/layout/document-tab";
import { ViewTab } from "../../../src/app/models/layout/view-tab";
import { TabFocusService } from "../../../src/app/services/tab-focus.service";
import { DomFixture } from "../../fixtures/dom.fixture";

describe("TabFocusService", () => {
  const plan = new DocumentTab("notes.note", "plan");
  let elements: HTMLButtonElement[];

  beforeEach(() => {
    elements = [new ViewTab("notes.list"), plan].map(tab => {
      const element = document.createElement("button");
      element.dataset["tabKey"] = tab.key;
      return document.body.appendChild(element);
    });
  });

  afterEach(() => elements.forEach(t => t.remove()));

  it("focuses a tab after the next render", () => {
    const focus = TestBed.inject(TabFocusService);

    focus.focus(plan);
    const before = document.activeElement;
    TestBed.tick();

    expect([before, document.activeElement]).toEqual([document.body, elements[1]]);
  });

  it("scrolls a partly hidden tab it focuses into view, clear of the actions at its scroller's end", () => {
    const focus = TestBed.inject(TabFocusService);
    const scroller = document.body.appendChild(document.createElement("div"));
    scroller.style.cssText = "display: flex; width: 120px; overflow-x: scroll; scroll-padding-inline-end: 30px";
    elements.forEach(t => {
      t.style.cssText = "flex: 0 0 80px";
      scroller.appendChild(t);
    });
    const actions = scroller.appendChild(document.createElement("div"));
    actions.style.cssText = "flex: 0 0 30px; position: sticky; inset-inline-end: 0";
    try {
      focus.focus(plan);
      TestBed.tick();
      const tab = elements[1]?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const box = scroller.getBoundingClientRect();
      const end = actions.getBoundingClientRect();

      expect(document.activeElement).toBe(elements[1]);
      expect([tab.left >= box.left, tab.right <= end.left]).toEqual([true, true]);
    }
    finally {
      scroller.remove();
    }
  });

  function rowOf(width: number, direction: string): HTMLElement {
    const row = document.body.appendChild(document.createElement("div"));
    row.className = "nol-tab-group-scroller";
    row.dir = direction;
    row.style.cssText = `display: flex; width: ${width}px; overflow-x: scroll; scroll-padding-inline-end: 30px`;
    elements.forEach(t => {
      t.style.cssText = "flex: 0 0 100px";
      row.appendChild(t);
    });
    return row;
  }

  it("keeps a row where it is when the tab to focus is at least partly shown beside the row's actions, in either direction", () => {
    const focus = TestBed.inject(TabFocusService);
    const kept = ["ltr", "rtl"].map(direction => {
      const row = rowOf(150, direction);
      try {
        focus.focus(plan, true);
        TestBed.tick();
        return [document.activeElement === elements[1], row.scrollLeft];
      }
      finally {
        row.remove();
      }
    });

    expect(kept).toEqual([[true, 0], [true, 0]]);
  });

  it("reveals the tab to focus when it is wholly outside the row, past its actions or before its start, in either direction, though the row is to be kept", () => {
    const focus = TestBed.inject(TabFocusService);
    const revealAt = (direction: string, tab: DocumentTab | ViewTab, scrolled: number): number => {
      const row = rowOf(100, direction);
      try {
        row.scrollLeft = scrolled;
        focus.focus(tab, true);
        TestBed.tick();
        return row.scrollLeft;
      }
      finally {
        row.remove();
      }
    };

    expect([revealAt("ltr", plan, 0) > 0, revealAt("ltr", new ViewTab("notes.list"), 100) < 100, revealAt("rtl", plan, 0) < 0]).toEqual([true, true, true]);
  });

  it("focuses a tab outside any row, and nothing for a tab that isn't shown, when the row is to be kept", () => {
    const focus = TestBed.inject(TabFocusService);

    focus.focus(plan, true);
    TestBed.tick();
    focus.focus(new ViewTab("files.tree"), true);
    TestBed.tick();

    expect(document.activeElement).toBe(elements[1]);
  });

  it("focuses a tab after the next render only when focus was lost, and nothing for a tab that isn't shown", () => {
    const focus = TestBed.inject(TabFocusService);
    elements[0]?.focus();

    focus.focusIfLost(plan);
    TestBed.tick();
    const kept = document.activeElement;
    elements[0]?.blur();
    focus.focusIfLost(new ViewTab("files.tree"));
    TestBed.tick();
    const missing = document.activeElement;
    focus.focusIfLost(plan);
    TestBed.tick();

    expect([kept, missing, document.activeElement]).toEqual([elements[0], document.body, elements[1]]);
  });

  it("asks a tab's content for the focus until it settles, the time limit passes, the focus moves outside the tab and its content, or another tab of its group is active", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const focus = TestBed.inject(TabFocusService);
    const list = new ViewTab("notes.list");
    const content = document.body.appendChild(document.createElement("div"));
    content.dataset["tabContent"] = plan.key;
    const field = content.appendChild(document.createElement("input"));
    const ask = (): void => focus.focusContent(plan);
    try {
      ask();
      field.focus();
      elements[1]?.focus();
      const kept = focus.isContentAsked(plan);
      vi.advanceTimersByTime(9_999);
      const beforeLimit = focus.isContentAsked(plan);
      vi.advanceTimersByTime(1);
      const afterLimit = focus.isContentAsked(plan);
      ask();
      document.dispatchEvent(new FocusEvent("focusin"));
      const fromDocument = focus.isContentAsked(plan);
      ask();
      elements[0]?.focus();
      const outside = focus.isContentAsked(plan);
      ask();
      focus.settleContent(list);
      focus.followActive([list, plan], plan);
      const stillAsked = focus.isContentAsked(plan);
      focus.followActive([list, plan], list);
      const otherActive = focus.isContentAsked(plan);
      ask();
      focus.settleContent(plan);

      expect([kept, beforeLimit, afterLimit, fromDocument, outside, stillAsked, otherActive]).toEqual([true, true, false, false, false, true, false]);
      expect([focus.content(), focus.isContentAsked(list)]).toEqual([null, false]);
    }
    finally {
      vi.useRealTimers();
      content.remove();
    }
  });

  it.each([
    ["pointerdown", (target: EventTarget): boolean => target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))],
    ["keydown", (target: EventTarget): boolean => target.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }))]
  ])("keeps a tab's request for the focus through a %s on the tab or its content, and drops it for one anywhere else", (_, press) => {
    const focus = TestBed.inject(TabFocusService);
    const content = document.body.appendChild(document.createElement("div"));
    content.dataset["tabContent"] = plan.key;
    const text = content.appendChild(document.createElement("p"));
    const outside = document.body.appendChild(document.createElement("p"));
    try {
      focus.focusContent(plan);
      press(DomFixture.present(elements[1]));
      press(text);
      const inside = focus.isContentAsked(plan);
      press(outside);
      const elsewhere = focus.isContentAsked(plan);
      focus.focusContent(plan);
      press(document);
      const fromDocument = focus.isContentAsked(plan);

      expect([inside, elsewhere, fromDocument]).toEqual([true, false, false]);
    }
    finally {
      content.remove();
      outside.remove();
    }
  });
});
