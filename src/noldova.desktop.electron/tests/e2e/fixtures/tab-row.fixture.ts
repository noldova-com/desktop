/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { type Locator, type Page, expect } from "@playwright/test";

import { TabKeyMissingException } from "../exceptions/tab-key-missing.exception.ts";

export class TabRowFixture {
  public static readonly CLEAR: string = "clear";

  public static clearanceOf(tab: Locator): Promise<string> {
    return tab.evaluate((t, clear) => {
      const scroller = t.closest(".nol-tab-group-scroller");
      const box = scroller?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const actions = scroller?.querySelector(".nol-tab-group-actions")?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const rect = t.getBoundingClientRect();
      const isClear = scroller !== null && getComputedStyle(scroller).direction === "rtl"
        ? rect.right <= box.right + 1 && rect.left >= actions.right - 1
        : rect.left >= box.left - 1 && rect.right <= actions.left + 1;
      return isClear ? clear : JSON.stringify({ tab: [rect.left, rect.right], scroller: [box.left, box.right], actions: [actions.left, actions.right] });
    }, TabRowFixture.CLEAR);
  }

  public static async showAsync(window: Page, tab: Locator): Promise<void> {
    const key = await tab.getAttribute("data-tab-key");
    if (key === null)
      throw new TabKeyMissingException();
    if (await TabRowFixture.clearanceOf(tab) !== TabRowFixture.CLEAR) {
      await tab.locator("xpath=ancestor::nol-tab-group").locator(".nol-tab-group-overflow").click();
      await window.locator(`.cdk-overlay-container .nol-tab-group-overflow-tab[data-tab="${key}"]`).click();
    }
    await expect.poll(() => TabRowFixture.clearanceOf(tab), { message: "the tab scrolls into view whole" }).toBe(TabRowFixture.CLEAR);
  }

  public static thumbOf(group: Locator): Promise<Readonly<Record<"rem" | "height" | "bottomGap" | "rowHeight" | "barHeight", number> & { readonly color: string; readonly hidden: boolean }>> {
    return group.evaluate(t => {
      const bar = t.querySelector(".nol-tab-group-tabs");
      const scroller = t.querySelector(".nol-tab-group-scroller");
      const thumb = t.querySelector<HTMLElement>(".nol-tab-group-thumb");
      const [row, box] = [bar?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN), thumb?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN)];
      return {
        rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        height: box.height,
        bottomGap: row.bottom - box.bottom,
        rowHeight: row.height,
        barHeight: scroller instanceof HTMLElement ? scroller.offsetHeight - scroller.clientHeight : Number.NaN,
        color: thumb === null ? "none" : getComputedStyle(thumb).backgroundColor,
        hidden: thumb?.hidden !== false
      };
    });
  }

  // Where each element around the row lies and how far it is scrolled, up to the page's root, so a spec can tell that only
  // the row moved.
  public static surroundingsOf(scroller: Locator): Promise<string> {
    return scroller.evaluate(t => {
      const places: string[] = [];
      for (let around = t.parentElement; around !== null; around = around.parentElement) {
        const box = around.getBoundingClientRect();
        places.push([around.tagName, around.scrollLeft, around.scrollTop, box.x, box.y, box.width, box.height].join(" "));
      }
      return places.join("\n");
    });
  }

  public static async setDirectionAsync(window: Page, direction: "ltr" | "rtl"): Promise<void> {
    await window.evaluate(t => document.documentElement.setAttribute("dir", t), direction);
  }

  public static insetsOf(group: Locator): Promise<Readonly<Record<"rem" | "firstTab" | "lastAction" | "content", number>>> {
    return group.evaluate(t => {
      const isReversed = getComputedStyle(t).direction === "rtl";
      const card = t.querySelector("nol-panel-card");
      const box = card?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const border = card?.clientLeft ?? 0;
      const first = t.querySelector("nol-tab")?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const last = [...t.querySelectorAll(".nol-tab-group-actions button")].at(-1)?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const content = t.querySelector(".nol-tab-pill, .nol-tab-group-title");
      const text = content?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
      const padding = Number.parseFloat(content === null ? "" : getComputedStyle(content).paddingInlineStart);
      return {
        rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        firstTab: isReversed ? box.right - border - first.right : first.left - box.left - border,
        lastAction: isReversed ? last.left - box.left - border : box.right - border - last.right,
        content: isReversed ? box.right - border - text.right + padding : text.left + padding - box.left - border
      };
    });
  }
}
