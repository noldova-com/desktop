/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator } from "@playwright/test";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { TabRowFixture } from "./fixtures/tab-row.fixture.ts";

test.use({ mainProcessDataFiles: { "modules/notes/many-tabs": String.empty } });

function keysOf(tabs: Locator, name: string = "data-tab-key"): Promise<(string | null)[]> {
  return tabs.evaluateAll((t, attribute) => t.map(u => u.getAttribute(attribute)), name);
}

test.describe("a side group's tab row at the default window size", () => {
  test("scrolls sideways by wheel and by its thin thumb, keeps the active tab whole, and scrolls a tab chosen in Show all tabs into view, in light and dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await mainProcess.useViewportAsync(1280, 800);
    const group = window.locator("nol-tab-group[data-side=Right]").first();
    const scroller = group.locator(".nol-tab-group-scroller");
    const tabs = group.locator(".nol-tab-group-strip > nol-tab");
    const thumb = group.locator(".nol-tab-group-thumb");
    const menu = window.locator(".cdk-overlay-container nol-menu");
    const scrollAsync = (): Promise<number> => scroller.evaluate(t => t.scrollLeft);
    await expect(tabs).not.toHaveCount(0);
    expect(await tabs.count()).toBeGreaterThanOrEqual(3);

    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await expect.poll(() => scroller.evaluate(t => t.scrollWidth > t.clientWidth), { message: `the tabs overflow, ${scheme}` }).toBe(true);
      await expect.poll(() => TabRowFixture.clearanceOf(group.locator(".nol-tab-group-strip > nol-tab[aria-selected=true]")), { message: `the active tab shows whole, ${scheme}` })
        .toBe(TabRowFixture.CLEAR);
      const surroundings = await TabRowFixture.surroundingsOf(scroller);

      await window.mouse.move(0, 0);
      const away = await TabRowFixture.thumbOf(group);
      await tabs.first().hover();
      await expect.poll(async () => (await TabRowFixture.thumbOf(group)).color, { message: `the thumb shows while the pointer is over the row, ${scheme}` }).not.toBe(away.color);
      const shown = await TabRowFixture.thumbOf(group);
      expect([away.color, shown.hidden, shown.barHeight, shown.rowHeight]).toEqual(["rgba(0, 0, 0, 0)", false, 0, away.rowHeight]);
      expect(Math.abs(shown.height - 0.375 * shown.rem)).toBeLessThan(0.5);
      expect(Math.abs(shown.bottomGap)).toBeLessThan(0.5);
      await mainProcess.checkpointAsync(`tab-row-scroll-${scheme}`);

      await scroller.evaluate(t => t.scrollTo({ left: 0 }));
      await window.mouse.wheel(0, 120);
      await expect.poll(scrollAsync, { message: `a vertical wheel scrolls the row sideways, ${scheme}` }).toBeGreaterThan(0);
      expect(await TabRowFixture.surroundingsOf(scroller), `the wheel moves only the row, ${scheme}`).toBe(surroundings);
      await scroller.evaluate(t => t.scrollTo({ left: 0 }));
      await expect.poll(scrollAsync).toBe(0);
      const grip = await thumb.boundingBox();
      if (grip === null)
        throw new Error("The thumb has no box.");
      const ratio = await scroller.evaluate(t => t.scrollWidth / t.clientWidth);
      await window.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
      await window.mouse.down();
      await window.mouse.move(grip.x + grip.width / 2 + 30, grip.y + grip.height / 2, { steps: 5 });
      await window.mouse.up();
      expect(Math.abs(await scrollAsync() - 30 * ratio), `dragging the thumb 30 pixels scrolls the row by as much along it, ${scheme}`).toBeLessThan(2);
      expect(await TabRowFixture.surroundingsOf(scroller), `the drag moves only the row, ${scheme}`).toBe(surroundings);

      await group.locator(".nol-tab-group-overflow").click();
      await expect(menu).toHaveCount(1);
      expect(await keysOf(menu.locator(".nol-tab-group-overflow-tab"), "data-tab")).toEqual(await keysOf(tabs));
      const chosen = await tabs.first().getAttribute("data-tab-key") ?? String.empty;
      expect(await TabRowFixture.clearanceOf(tabs.first()), `the first tab is scrolled out of view, ${scheme}`).not.toBe(TabRowFixture.CLEAR);
      await menu.locator(`.nol-tab-group-overflow-tab[data-tab="${chosen}"]`).click();
      await expect(menu).toHaveCount(0);
      await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
      await expect.poll(() => TabRowFixture.clearanceOf(tabs.first()), { message: `the chosen tab scrolls into view whole, ${scheme}` }).toBe(TabRowFixture.CLEAR);
      await expect(tabs.first()).toBeFocused();
      expect(Math.abs(await scrollAsync())).toBeLessThanOrEqual(1);
      expect(await TabRowFixture.surroundingsOf(scroller), `choosing a tab in Show all tabs moves only the row, ${scheme}`).toBe(surroundings);
    }
  });

  test("with three views, End and Home scroll the last and first tab into view whole, and Show all tabs lists all three, in light and dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await mainProcess.useViewportAsync(1280, 800);
    const group = window.locator("nol-tab-group[data-side=Right]").first();
    const scroller = group.locator(".nol-tab-group-scroller");
    const tabs = group.locator(".nol-tab-group-strip > nol-tab");
    const menu = window.locator(".cdk-overlay-container nol-menu");
    const byTitle = (title: string): Locator => group.locator(`.nol-tab-group-strip > nol-tab[aria-label="${title}"]`);
    const closeAsync = async (title: string, label: string, left: readonly string[]): Promise<void> => {
      await TabRowFixture.showAsync(window, byTitle(title));
      await byTitle(title).click({ button: "right" });
      await menu.getByRole("menuitem").filter({ has: window.locator(".nol-menu-item-label").getByText(label, { exact: true }) }).click();
      await expect(menu).toHaveCount(0);
      await expect.poll(() => tabs.evaluateAll(t => t.map(u => u.getAttribute("aria-label")))).toEqual(left);
    };
    await closeAsync("References and call hierarchy", "Close to the right", ["Clock", "Teammates", "Conversation", "Timeline", "References and call hierarchy"]);
    await closeAsync("Timeline", "Close", ["Clock", "Teammates", "Conversation", "References and call hierarchy"]);
    await closeAsync("Clock", "Close", ["Teammates", "Conversation", "References and call hierarchy"]);
    await TabRowFixture.showAsync(window, byTitle("Teammates"));
    await byTitle("Teammates").click();

    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      const range = await scroller.evaluate(t => t.scrollWidth - t.clientWidth);
      expect(range, `the three tabs overflow, ${scheme}`).toBeGreaterThan(0);
      await byTitle("Teammates").focus();
      const surroundings = await TabRowFixture.surroundingsOf(scroller);
      await window.keyboard.press("End");
      await expect(byTitle("References and call hierarchy")).toBeFocused();
      await expect.poll(() => TabRowFixture.clearanceOf(byTitle("References and call hierarchy")), { message: `End scrolls the last tab into view, ${scheme}` }).toBe(TabRowFixture.CLEAR);
      expect(Math.abs(await scroller.evaluate(t => t.scrollLeft) - range)).toBeLessThan(1);
      expect(await TabRowFixture.surroundingsOf(scroller), `End moves only the row, ${scheme}`).toBe(surroundings);
      await mainProcess.checkpointAsync(`tab-row-scroll-three-${scheme}`);
      await window.keyboard.press("Home");
      await expect(byTitle("Teammates")).toBeFocused();
      await expect.poll(() => TabRowFixture.clearanceOf(byTitle("Teammates")), { message: `Home scrolls the first tab into view, ${scheme}` }).toBe(TabRowFixture.CLEAR);
      expect(Math.abs(await scroller.evaluate(t => t.scrollLeft))).toBeLessThanOrEqual(1);
      expect(await TabRowFixture.surroundingsOf(scroller), `Home moves only the row, ${scheme}`).toBe(surroundings);
      await group.locator(".nol-tab-group-overflow").click();
      await expect(menu.locator(".nol-tab-group-overflow-tab .nol-menu-item-label")).toHaveText(["Teammates", "Conversation", "References and call hierarchy"]);
      await window.keyboard.press("Escape");
      await expect(menu).toHaveCount(0);
    }
  });
});
