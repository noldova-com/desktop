/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";

const switchName = "Runs the clock and the modules that need it.";

test.describe("module switch", () => {
  test("a module turned off in Settings stops with its dependent, both counted as off rather than failed, and shows its view off with its switch, which turns them on again", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const face = window.locator("[data-fixture-content=clock-face]");
    const faceTab = window.locator("nol-tab[data-tab-key=\"view/clock.face\"]");
    const card = window.locator("nol-module-failure-card");
    const failures = window.locator("nol-module-failures button.nol-module-failures-item");
    const states = window.locator(".nol-modules-row .nol-modules-state-label");
    await expect(face).toHaveText(/^The runtime's time is /);

    await SettingsFixture.openPageAsync(window, "Clock");
    await window.locator("nol-settings").getByRole("checkbox", { name: switchName }).click();

    await expect(faceTab.locator(".nol-tab-icon")).toHaveText("toggle_off");
    await expect(face).toHaveCount(0);
    await expect(card.locator(".nol-module-failure-card-title")).toHaveText(/Clock is off/);
    await expect(card.getByRole("checkbox", { name: switchName })).not.toBeChecked();
    await expect(window.locator("nol-settings").getByRole("checkbox", { name: switchName })).not.toBeChecked();
    await expect(failures).toHaveCount(0);

    await CommandSearchFixture.searchAsync(window, "Modules");
    await window.keyboard.press("Enter");
    const detail = window.locator("nol-modules .nol-modules-detail");
    await window.locator("nol-modules .nol-modules-row[data-module=alarm]").click();
    await expect(window.locator("nol-modules [aria-current=true]")).toHaveAttribute("data-module", "alarm");
    await expect(detail.locator(".nol-modules-fact-state")).toHaveText(/Blocked\s*It depends on clock, which is off\./);
    await expect(detail.locator(".nol-modules-fact-blocker")).toHaveText("Clock");
    await expect(states).toHaveText(["Off", "Active", "Active", "Active", "Blocked", "Active"]);
    await window.locator("nol-modules .nol-modules-row[data-module=clock]").click();
    await expect(detail.locator(".nol-modules-fact-switch").getByRole("checkbox", { name: switchName })).not.toBeChecked();
    await mainProcess.checkpointAsync("module-off");

    await card.getByRole("checkbox", { name: switchName }).click();

    await expect(face).toHaveText(/^The runtime's time is /);
    await expect(faceTab.locator(".nol-tab-icon")).not.toHaveText("toggle_off");
    await expect(card).toHaveCount(0);
    await expect(failures).toHaveCount(0);
    await expect(states).toHaveText(["Active", "Active", "Active", "Active", "Active", "Active"]);
    await expect(detail.locator(".nol-modules-fact-switch").getByRole("checkbox", { name: switchName })).toBeChecked();
  });
});
