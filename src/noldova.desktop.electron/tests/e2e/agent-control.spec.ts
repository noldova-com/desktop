/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

test.describe("agent control", () => {
  test("Stop agents shows Resume above every open view of a module that offers tools, in light and in dark, and Resume takes it from all of them", async ({ mainProcess }, testInfo) => {
    const window = mainProcess.window;
    const bars = window.locator(".nol-tab-slot-stopped");

    await CommandSearchFixture.searchAsync(window, "Stop agents");
    await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/desktop.stopAgentControl");
    await window.keyboard.press("Enter");
    await expect(bars.first()).toBeVisible();
    const shown = await bars.count();
    const slots = await window.locator("nol-tab-slot").evaluateAll(t => t.filter(u => u.querySelector("[data-tab-content*='notes.']") !== null).length);
    for (const mode of WindowModeFixture.modes) {
      await WindowModeFixture.setAsync(window, mode);
      const image = await mainProcess.checkpointAsync(`agents-stopped-${mode.toLowerCase()}`);
      await writeFile(path.join(testInfo.project.outputDir, "..", `agents-stopped-${mode.toLowerCase()}-${process.platform}-${process.arch}.png`), image);
    }
    await bars.first().getByRole("button", { name: "Resume" }).click();

    await expect(bars).toHaveCount(0);
    expect(shown).toBe(slots);
  });
});
