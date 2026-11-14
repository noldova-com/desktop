/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { ClockWorkFixture } from "./fixtures/clock-work.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { LayoutFixture } from "./fixtures/layout.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";

async function openMenuAsync(window: Page): Promise<Locator> {
  await window.locator("nol-tab-group:has(nol-tab[data-tab-key=\"document/notes.note/1\"]) .nol-tab-group-menu").click();
  const menu = window.getByRole("menu").last();
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("200% zoom", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
    await mainProcess.zoomAsync(2, 960);
  });

  test("the window row, the status bar and the tab bars keep every control inside the window, uncovered and at least 24 × 24 px or spaced as large, and nothing scrolls sideways", async ({ mainProcess }) => {
    const window = mainProcess.window;

    expect(await window.evaluate(() => document.documentElement.scrollWidth)).toBe(960);
    expect(await LayoutFixture.findProblemsAsync(window.locator("nol-window-row, nol-status-bar, .nol-tab-group-bar"))).toEqual([]);
    await mainProcess.checkpointAsync("zoom-window");
  });

  test("a menu opens 0.5rem inside the window, and the arrow keys reach each of its items in view", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const menu = await openMenuAsync(window);
    const items = await menu.getByRole("menuitem").count();

    expect(await LayoutFixture.findProblemsAsync(menu, LayoutFixture.OVERLAY_INSET)).toEqual([]);
    expect(await LayoutFixture.findFocusProblemsAsync(window, "ArrowDown", items)).toEqual([]);
    await mainProcess.checkpointAsync("zoom-menu");
  });

  test("a dialog opens 0.5rem inside the window, and Tab reaches each of its actions in view", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await ClockWorkFixture.beginAsync(mainProcess);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    await mainProcess.application.evaluate(({ app }) => app.quit());
    await expect(asking).toBeVisible();

    expect(await LayoutFixture.findProblemsAsync(window.locator("nol-dialog"), LayoutFixture.OVERLAY_INSET)).toEqual([]);
    expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", await asking.getByRole("button").count() + 1)).toEqual([]);
    await mainProcess.checkpointAsync("zoom-dialog");
    await window.keyboard.press("Escape");
    await expect(asking).toHaveCount(0);
    await ClockWorkFixture.finishAsync(mainProcess.dataDirectory);
  });

  test("a 10rem dock's selected tab in a 1280 × 800 window ends its title with an ellipsis after its first letters, clear of the actions, which fold into the overflow list but Hide", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await mainProcess.zoomAsync(1, 1920);
    await mainProcess.useViewportAsync(1280, 800);
    await mainProcess.zoomAsync(2, 640);
    const left = window.locator("nol-dock[data-side=Left]");
    await left.locator(".nol-dock-strip-view").first().click();
    await expect(left).not.toHaveClass(/nol-dock-collapsed/);
    await window.locator("nol-tab[data-tab-key=\"view/notes.outline\"]").click();
    const group = window.locator("nol-tab-group:has(nol-tab[data-tab-key=\"view/notes.outline\"])");
    await expect(group.locator(".nol-tab-group-overflow")).toBeVisible();

    const shown = await group.evaluate(element => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const tab = element.querySelector<HTMLElement>("nol-tab[data-tab-key=\"view/notes.outline\"]");
      if (tab === null)
        throw new Error("Nothing matches nol-tab[data-tab-key=\"view/notes.outline\"].");
      const label = tab.querySelector<HTMLElement>(".nol-tab-label");
      if (label === null)
        throw new Error("Nothing matches .nol-tab-label.");
      const actions = element.querySelector<HTMLElement>(".nol-tab-group-scroller > .nol-tab-group-actions");
      if (actions === null)
        throw new Error("Nothing matches .nol-tab-group-scroller > .nol-tab-group-actions.");
      const probe = document.body.appendChild(document.createElement("span"));
      probe.style.font = getComputedStyle(label).font;
      probe.style.whiteSpace = "nowrap";
      probe.textContent = `${label.innerText.slice(0, 2)}…`;
      const least = probe.getBoundingClientRect().width;
      probe.remove();
      return {
        width: Math.round(element.getBoundingClientRect().width / rem),
        isCut: label.scrollWidth > label.clientWidth,
        isWideEnough: label.getBoundingClientRect().width >= least,
        isClear: tab.getBoundingClientRect().right <= actions.getBoundingClientRect().left + 0.5,
        actions: [...actions.querySelectorAll("button")].map(t => t.getAttribute("aria-label"))
      };
    });

    expect(shown).toEqual({ width: 10, isCut: true, isWideEnough: true, isClear: true, actions: ["Show all tabs", "Hide the left dock"] });
    await mainProcess.checkpointAsync("zoom-narrow-dock");
  });

  for (const title of ["General", "Appearance"])
    test(`Settings keeps its pages and its ${title} page's rows inside the window and uncovered, nothing scrolls sideways, and Tab reaches each field in view`, async ({ mainProcess }) => {
      const window = mainProcess.window;
      await SettingsFixture.openPageAsync(window, title);
      const settings = window.locator("nol-settings");

      expect(await window.evaluate(() => document.documentElement.scrollWidth)).toBe(960);
      expect(await LayoutFixture.findProblemsAsync(settings)).toEqual([]);
      await settings.click({ position: { x: 4, y: 4 } });
      expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", await LayoutFixture.countTabStopsAsync(settings))).toEqual([]);
      await mainProcess.checkpointAsync(`zoom-settings-${title.toLowerCase()}`);
    });
});
