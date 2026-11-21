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

  it("focuses a tab without scrolling the row that holds it, and nothing for a tab that isn't shown", () => {
    const focus = TestBed.inject(TabFocusService);
    const row = document.body.appendChild(document.createElement("div"));
    row.style.cssText = "display: flex; width: 100px; overflow: hidden";
    elements.forEach(t => {
      t.style.cssText = "flex: 0 0 100px";
      row.appendChild(t);
    });
    try {
      focus.focus(plan);
      TestBed.tick();
      focus.focus(new ViewTab("files.tree"));
      TestBed.tick();

      expect([document.activeElement, row.scrollLeft]).toEqual([elements[1], 0]);
    }
    finally {
      row.remove();
    }
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
