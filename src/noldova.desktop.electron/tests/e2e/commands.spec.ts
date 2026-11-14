/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test.describe("commands", () => {
  test("a window part's command runs from its default key", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await window.locator("[data-fixture-content=notes-list]").click();

    await window.keyboard.press("ControlOrMeta+Alt+KeyN");

    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/3\"] .nol-tab-label")).toHaveText("Note 3");
    await expect(window.locator("[data-fixture-content=notes-note-3]")).toHaveText("Note 3");
    await mainProcess.checkpointAsync("commands-new-note");
  });

  test("a runtime part's command runs through the protocol from its default key", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const ticks = window.locator("[data-fixture-content=clock-ticks]");
    await expect(ticks).toHaveText("No ticks");
    await window.locator("[data-fixture-content=notes-list]").click();

    await window.keyboard.press("ControlOrMeta+Alt+KeyT");
    await expect(ticks).toHaveText("Ticks: 1");
    await window.keyboard.press("ControlOrMeta+Alt+KeyT");

    await expect(ticks).toHaveText("Ticks: 2");
  });
});
