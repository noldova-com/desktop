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
  test("shows only whole tabs inside its own box, lists the rest in Show all tabs and keeps the shown tab in the row, in light and dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await mainProcess.useViewportAsync(1280, 800);
    const group = window.locator("nol-tab-group[data-side=Right]").first();
    const tabs = group.locator(".nol-tab-group-strip > nol-tab");
    const hidden = group.locator(".nol-tab-group-strip > nol-tab.nol-tab-overflowed");
    const shown = group.locator(".nol-tab-group-strip > nol-tab:not(.nol-tab-overflowed)");
    const menu = window.locator(".cdk-overlay-container nol-menu");
    await expect(tabs).not.toHaveCount(0);
    expect(await tabs.count()).toBeGreaterThanOrEqual(3);

    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await expect.poll(() => hidden.count(), { message: `some tabs don't fit, ${scheme}` }).toBeGreaterThan(0);
      for (const tab of await shown.all())
        expect(await TabRowFixture.clearanceOf(tab), `${await tab.getAttribute("data-tab-key")} shows whole, ${scheme}`).toBe(TabRowFixture.CLEAR);
      await expect(group.locator(".nol-tab-group-strip > nol-tab[aria-selected=true]")).not.toHaveClass(/nol-tab-overflowed/);
      expect(await group.locator(".nol-tab-group-scroller").evaluate(t => t.scrollLeft)).toBe(0);
      await mainProcess.checkpointAsync(`whole-tabs-${scheme}`);

      const hiddenKeys = await keysOf(hidden);
      await group.locator(".nol-tab-group-overflow").click();
      await expect(menu).toHaveCount(1);
      const listed = await keysOf(menu.locator(".nol-tab-group-overflow-tab"), "data-tab");
      expect(listed).toEqual(await keysOf(tabs));
      expect(listed).toEqual(expect.arrayContaining(hiddenKeys));
      const chosen = hiddenKeys.at(-1) ?? String.empty;
      await menu.locator(`.nol-tab-group-overflow-tab[data-tab="${chosen}"]`).click();
      await expect(menu).toHaveCount(0);
      const tab = group.locator(`.nol-tab-group-strip > nol-tab[data-tab-key="${chosen}"]`);
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(tab).not.toHaveClass(/nol-tab-overflowed/);
      await expect.poll(() => TabRowFixture.clearanceOf(tab), { message: `the chosen tab shows whole, ${scheme}` }).toBe(TabRowFixture.CLEAR);
      for (const other of await shown.all())
        expect(await TabRowFixture.clearanceOf(other), `${await other.getAttribute("data-tab-key")} shows whole after choosing, ${scheme}`).toBe(TabRowFixture.CLEAR);
    }
  });
});
