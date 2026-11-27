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
      const isClear = scroller !== null && getComputedStyle(t).visibility !== "hidden" && getComputedStyle(scroller).direction === "rtl"
        ? rect.right <= box.right + 1 && rect.left >= actions.right - 1
        : scroller !== null && getComputedStyle(t).visibility !== "hidden" && rect.left >= box.left - 1 && rect.right <= actions.left + 1;
      return isClear ? clear : JSON.stringify({ tab: [rect.left, rect.right], scroller: [box.left, box.right], actions: [actions.left, actions.right] });
    }, TabRowFixture.CLEAR);
  }

  public static async showAsync(window: Page, tab: Locator): Promise<void> {
    const key = await tab.getAttribute("data-tab-key");
    if (key === null)
      throw new TabKeyMissingException();
    if (await tab.evaluate(t => t.classList.contains("nol-tab-overflowed"))) {
      await tab.locator("xpath=ancestor::nol-tab-group").locator(".nol-tab-group-overflow").click();
      await window.locator(`.cdk-overlay-container .nol-tab-group-overflow-tab[data-tab="${key}"]`).click();
    }
    await expect(tab).not.toHaveClass(/nol-tab-overflowed/);
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
      const last = [...t.querySelectorAll(".nol-tab-group-actions button .nol-icon-button-glyph")].at(-1)?.getBoundingClientRect() ?? new DOMRect(Number.NaN, Number.NaN);
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
