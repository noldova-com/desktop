/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ClockWorkFixture } from "./fixtures/clock-work.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { LayoutFixture } from "./fixtures/layout.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";

test.describe("the smallest window", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
    await mainProcess.useViewportAsync(640, 480);
  });

  test("keeps the window row, the status bar, the tab bars and the collapsed docks' strips inside the window and uncovered, and the document area in view", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const documents = window.locator("nol-tab-group:has(nol-tab[data-tab-key=\"document/notes.note/1\"])");

    await expect(window.locator(".nol-dock-strip").first()).toBeVisible();
    expect(await window.evaluate(() => document.documentElement.scrollWidth)).toBe(640);
    expect(await LayoutFixture.findProblemsAsync(window.locator("nol-window-row, nol-status-bar, .nol-tab-group-bar, .nol-dock-strip:visible"))).toEqual([]);
    expect(await LayoutFixture.findCutTextAsync(window.locator("nol-window-row, nol-status-bar, .nol-tab-group-bar"))).toEqual([]);
    expect(await documents.locator(".nol-tab-group-body").evaluate(t => {
      const box = t.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return box.width > 0 && box.height > 0 && box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight && hit !== null && t.contains(hit);
    })).toBe(true);
    await mainProcess.checkpointAsync("small-window");
  });

  test("opens a dialog 0.5rem inside the window, and Tab reaches each of its actions in view", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await ClockWorkFixture.beginAsync(mainProcess);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    await mainProcess.application.evaluate(({ app }) => app.quit());
    await expect(asking).toBeVisible();

    expect(await LayoutFixture.findProblemsAsync(window.locator("nol-dialog"), LayoutFixture.OVERLAY_INSET)).toEqual([]);
    expect(await LayoutFixture.findCutTextAsync(window.locator("nol-dialog"))).toEqual([]);
    expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", await LayoutFixture.countTabStopsAsync(window.locator("nol-dialog")))).toEqual([]);
    await mainProcess.checkpointAsync("small-window-dialog");
    await window.keyboard.press("Escape");
    await expect(asking).toHaveCount(0);
    await ClockWorkFixture.finishAsync(mainProcess.dataDirectory);
  });

  for (const title of ["General", "Appearance"])
    test(`keeps the rows of Settings' ${title} page inside the window, uncovered and uncut with nothing scrolling sideways, and Tab reaches each of its fields in view`, async ({ mainProcess }) => {
      const window = mainProcess.window;
      await SettingsFixture.openPageAsync(window, title);
      const settings = window.locator("nol-settings");

      expect(await window.evaluate(() => document.documentElement.scrollWidth)).toBe(640);
      expect(await LayoutFixture.findProblemsAsync(settings)).toEqual([]);
      expect(await LayoutFixture.findCutTextAsync(settings)).toEqual([]);
      await settings.click({ position: { x: 4, y: 4 } });
      expect(await LayoutFixture.findFocusProblemsAsync(window, "Tab", await LayoutFixture.countTabStopsAsync(settings))).toEqual([]);
      await mainProcess.checkpointAsync(`small-window-settings-${title.toLowerCase()}`);
    });
});
