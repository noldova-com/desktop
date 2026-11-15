/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { ScrollAreaFixture } from "./fixtures/scroll-area.fixture.ts";

const documentsGroup = "nol-tab-group:has(nol-tab[data-tab-key='document/notes.note/1'])";
const bottomGroup = "nol-tab-group:has(nol-tab[data-tab-key='view/notes.terminal'])";
const architectureTitle = "Shell architecture review: the module contract, runtime boundaries and what the window may cache between restarts";

test.use({ mainProcessDataFiles: { "modules/notes/many-tabs": String.empty } });

function tooltip(window: Page): Locator {
  return window.locator(".cdk-overlay-container nol-tooltip");
}

function boxOf(locator: Locator): Promise<Readonly<Record<"left" | "top" | "right" | "bottom" | "width", number>>> {
  return locator.evaluate(t => {
    const box = t.getBoundingClientRect();
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width };
  });
}

test.describe("the window's look", () => {
  test("tabs stop at 16rem and show a cut title in full in a tooltip below, but not a whole one", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const long = window.locator(`${documentsGroup} nol-tab[aria-label="${architectureTitle}"]`);
    const short = window.locator(`${documentsGroup} nol-tab[aria-label="Bugs"]`);
    await long.scrollIntoViewIfNeeded();

    const shape = await long.evaluate(t => {
      const label = t.querySelector<HTMLElement>(".nol-tab-label");
      if (label === null)
        throw new Error("Nothing matches .nol-tab-label.");
      return { width: t.getBoundingClientRect().width, rem: Number.parseFloat(getComputedStyle(document.documentElement).fontSize), isCut: label.scrollWidth > label.clientWidth };
    });
    expect(shape.width).toBeLessThanOrEqual(16 * shape.rem + 0.5);
    expect(shape.isCut).toBe(true);
    await long.hover();
    await expect(tooltip(window)).toHaveText(architectureTitle);
    expect((await boxOf(tooltip(window))).top).toBeGreaterThan((await boxOf(long)).bottom);

    await short.scrollIntoViewIfNeeded();
    await short.hover();
    await expect(tooltip(window)).toHaveCount(0);
    expect(await short.locator(".nol-tab-label").evaluate(t => t.scrollWidth <= t.clientWidth)).toBe(true);
    await mainProcess.checkpointAsync("window-look-tabs");
  });

  test("a collapsed dock names its views in tooltips beside its strip", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await window.locator("nol-tab-group[data-side=Left] .nol-tab-group-hide").click();
    const strip = window.locator(".nol-dock-strip").first();
    await expect(strip).toBeVisible();
    const view = strip.locator(".nol-dock-strip-view").first();

    await view.hover();

    await expect(tooltip(window)).toHaveText(await view.getAttribute("aria-label") ?? String.empty);
    expect((await boxOf(tooltip(window))).left).toBeGreaterThanOrEqual((await boxOf(strip)).right);
  });

  test("scroll areas have 0.375rem scrollbars whose thumb shows only while hovered, without moving their content", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const content = window.locator(`${documentsGroup} nol-tab-content`);
    const scroller = window.locator(`${documentsGroup} .nol-tab-group-scroller`);

    const area = await ScrollAreaFixture.scrollbarSizesAsync(content);
    const strip = await ScrollAreaFixture.scrollbarSizesAsync(scroller);
    const quietStrip = await ScrollAreaFixture.scrollbarSizesAsync(window.locator(`${bottomGroup} .nol-tab-group-scroller`));
    expect(area.vertical).toBeCloseTo(0.375 * area.rem, 0);
    expect(strip.horizontal).toBeCloseTo(0.375 * strip.rem, 0);
    expect(quietStrip.horizontal).toBeCloseTo(0.375 * strip.rem, 0);
    const before = await boxOf(content.locator("h1"));
    expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, content, "vertical")).toBe(true);
    expect(await boxOf(content.locator("h1"))).toEqual(before);
    expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, scroller, "horizontal")).toBe(true);
  });

  test("a heading that wraps keeps its lines apart", async ({ mainProcess }) => {
    await mainProcess.useViewportAsync(900, 700);
    const window = mainProcess.window;
    await window.locator(`${documentsGroup} nol-tab[aria-label="${architectureTitle}"]`).click();
    const heading = window.locator(`${documentsGroup} h1`, { hasText: architectureTitle });
    await expect(heading).toHaveText(architectureTitle);

    const lines = await heading.evaluate(t => {
      const range = document.createRange();
      range.selectNodeContents(t);
      const tops = [...new Set([...range.getClientRects()].map(r => Math.round(r.top)))];
      const style = getComputedStyle(t);
      return { tops, lineHeight: Number.parseFloat(style.lineHeight), fontSize: Number.parseFloat(style.fontSize) };
    });

    expect(lines.tops.length).toBeGreaterThan(1);
    expect(lines.lineHeight).toBeGreaterThanOrEqual(lines.fontSize * 1.2);
    expect(lines.tops.slice(1).every((top, index) => top - (lines.tops[index] ?? 0) >= lines.fontSize)).toBe(true);
  });

  test("pads a page 0.75rem across, starting its content on its first tab's icon, a document's 1rem down and a docked view's 0.5rem, but not a view that turns it off", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const expectPaddingAsync = async (tab: string, page: string, padding: readonly number[], isOnIcon: boolean): Promise<void> => {
      await window.locator(`nol-tab[data-tab-key='${tab}']`).click();
      const group = window.locator(`nol-tab-group:has(nol-tab[data-tab-key='${tab}'])`);
      const content = group.locator("nol-tab-content:not([inert])");
      await expect(content.locator(page)).toBeVisible();
      await expect.poll(() => group.evaluate(t => {
        const host = t.querySelector<HTMLElement>("nol-tab-content:not([inert])");
        if (host === null)
          throw new Error("Nothing matches nol-tab-content.");
        const style = getComputedStyle(host);
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const contentStart = host.getBoundingClientRect().left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft);
        const iconElement = t.querySelector<HTMLElement>("nol-tab .nol-tab-icon");
        if (iconElement === null)
          throw new Error("Nothing matches nol-tab .nol-tab-icon.");
        const scroller = t.querySelector<HTMLElement>(".nol-tab-group-scroller");
        if (scroller === null)
          throw new Error("Nothing matches .nol-tab-group-scroller.");
        const icon = iconElement.getBoundingClientRect().left + scroller.scrollLeft;
        return [...[style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(p => Math.round(Number.parseFloat(p) / rem * 1000) / 1000), Math.round(contentStart - icon) === 0];
      })).toEqual([...padding, isOnIcon]);
    };

    await expectPaddingAsync("document/notes.note/1", "nol-notes-note", [1, 0.75, 1, 0.75], true);
    await expectPaddingAsync("view/clock.face", "nol-clock-face", [0.5, 0.75, 0.5, 0.75], true);
    await expectPaddingAsync("view/notes.outline", "nol-notes-outline", [0, 0, 0, 0], false);
  });
});

test.describe("the look of the icons a module gives", () => {
  test.use({ mainProcessDataFiles: { "modules/notes/sessions": String.empty } });

  test("a view tab's icon, given by openView or changed by updateView, is 1rem square, 0.25rem before its label and centred on it to the nearest pixel, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const shapeOf = (key: string): Promise<Readonly<{ icon: string; width: number; height: number; gap: number; centre: number }>> => window.locator(`nol-tab[data-tab-key='${key}']`).evaluate(t => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const toRem = (value: number, step: number): number => Math.round(value / rem * step) / step;
      const icon = t.querySelector<HTMLElement>(".nol-tab-icon");
      if (icon === null)
        throw new Error("Nothing matches .nol-tab-icon.");
      const box = icon.getBoundingClientRect();
      const labelElement = t.querySelector<HTMLElement>(".nol-tab-label");
      if (labelElement === null)
        throw new Error("Nothing matches .nol-tab-label.");
      const label = labelElement.getBoundingClientRect();
      return {
        icon: icon.textContent?.trim() ?? "", width: toRem(box.width, 1000), height: toRem(box.height, 1000), gap: toRem(label.left - box.right, 1000),
        centre: toRem((box.top + box.bottom - label.top - label.bottom) / 2, 16) + 0
      };
    });

    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      for (const [key, icon] of [["view/notes.session/7f3c9a2e-session-one", "code"], ["view/notes.session/b81d4e60-session-two", "bolt"]] as const)
        await expect.poll(() => shapeOf(key)).toEqual({ icon, width: 1, height: 1, gap: 0.25, centre: 0 });
      await mainProcess.checkpointAsync(`view-tab-icons-${scheme}`);
    }
  });

  test("a menu row's own icon stands where its command's icon does, 1rem square, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const main = window.locator("nol-toolbar[data-toolbar='notes.main']");
    const shapeOf = (name: string): Promise<Readonly<{ icon: string; left: number; top: number; width: number; height: number }>> => main.getByRole("button", { name }).evaluate(t => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const icon = t.querySelector<HTMLElement>(".material-symbols-rounded");
      if (icon === null)
        throw new Error("Nothing matches .material-symbols-rounded.");
      const box = icon.getBoundingClientRect();
      const button = t.getBoundingClientRect();
      const toRem = (value: number): number => Math.round(value / rem * 1000) / 1000;
      return { icon: icon.textContent?.trim() ?? "", left: toRem(box.left - button.left), top: toRem(box.top - button.top), width: toRem(box.width), height: toRem(box.height) };
    });

    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      const own = await shapeOf("Week 2");
      const command = await shapeOf("Week 1");

      expect([own.icon, command.icon]).toEqual(["calendar_month", "open_in_new"]);
      expect({ ...own, icon: String.empty }).toEqual({ ...command, icon: String.empty });
      expect([own.width, own.height]).toEqual([1, 1]);
      await mainProcess.checkpointAsync(`menu-row-icons-${scheme}`);
    }
  });
});
