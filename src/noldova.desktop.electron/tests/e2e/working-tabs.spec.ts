/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { TabContentFixture } from "./fixtures/tab-content.fixture.ts";

test.describe("working tabs", () => {
  test("a document a window part marks as working shows a busy tab with a spinner before its title, keeps Close on hover, and returns to normal once cleared", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const tab = window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]");
    const note = await TabContentFixture.openAsync(window, "document/notes.note/1");
    const work = note.locator("[data-fixture-content=notes-work-1]");

    await work.click();
    await expect(tab).toHaveAttribute("aria-busy", "true");
    await expect(tab.locator(".nol-tab-leading-spinner")).toBeVisible();
    await expect(tab.locator(".nol-tab-spinner")).toHaveCount(0);
    await mainProcess.checkpointAsync("working-tab");
    await tab.hover();
    await expect(tab.locator(".nol-tab-close")).toBeVisible();
    await expect(tab.locator(".nol-tab-leading-spinner")).toBeVisible();

    await work.click();
    await expect(tab).not.toHaveAttribute("aria-busy");
    await expect(tab.locator(".nol-tab-leading-spinner")).toHaveCount(0);
    await expect(window.locator("nol-tab[aria-busy]")).toHaveCount(0);
  });
});
