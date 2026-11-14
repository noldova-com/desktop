/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

async function runAsync(mainProcess: MainProcessFixture, text: string, command: string): Promise<void> {
  await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus());
  await expect.poll(() => mainProcess.window.evaluate(() => document.hasFocus())).toBe(true);
  await CommandSearchFixture.searchAsync(mainProcess.window, text);
  await mainProcess.window.locator(`.cdk-overlay-container .nol-search-pane [data-item="desktop.commands/${command}"]`).click();
}

test.describe("a module with only a runtime part", () => {
  test("names its notifications, is listed by name in Notifications from modules and, turned off there, toasts no more", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const toasts = window.locator(".nol-toast");
    const modules = window.locator("nol-setting-row[data-setting=\"desktop.mutedModules\"]");
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();

    await runAsync(mainProcess, "Remind me", "reminder.remind");
    await expect(toasts.locator(".nol-toast-title")).toHaveText(["Time for a break"]);
    await expect(toasts.locator(".nol-toast-meta")).toContainText("Reminder · ");
    await toasts.hover();
    await WindowModeFixture.expectStrongTextAsync(window, toasts.locator(".nol-toast-title"));
    await toasts.getByRole("button", { name: "Close" }).click();
    await SettingsFixture.openPageAsync(window, "Notifications");
    await expect(modules.getByRole("checkbox", { name: "Reminder notifications" })).toBeChecked();
    await mainProcess.checkpointAsync("runtime-only-module-notifications");
    await modules.getByRole("checkbox", { name: "Reminder notifications" }).uncheck();
    await runAsync(mainProcess, "Remind me", "reminder.remind");
    await runAsync(mainProcess, "Tick", "clock.tick");

    await expect(toasts.locator(".nol-toast-title")).toHaveText(["The clock ticked"]);
    await window.locator("button.nol-notifications-item").click();
    const reminders = window.locator(".nol-notifications-popover .nol-notifications-row").filter({ hasText: "Time for a break" });
    await expect(reminders).toHaveCount(2);
    await expect(reminders.first().locator(".nol-notifications-meta")).toContainText("Reminder · ");
  });

  test("is named in the module failures and the Modules document when it fails, and blocks the module from a package that depends on it", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const item = window.locator("nol-module-failures button.nol-module-failures-item");
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
    const folder = path.join(mainProcess.dataDirectory, "modules", "reminder");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "fail-activation"), String.empty);

    mainProcess.acceptRuntimeEnds();
    await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);
    await expect(item).toHaveText(/error\s*2 modules didn't start/);
    await item.click();

    await expect(window.locator(".nol-modules-detail-title")).toHaveText("Reminder");
    await expect(window.locator(".nol-modules-row[aria-current=true] .nol-modules-name")).toHaveText("Reminder");
    await expect(window.locator(".nol-modules-fact-state")).toHaveText(/Failed\s*Its runtime part failed to activate\./);

    const beacon = window.locator(".nol-modules-row[data-module=beacon]");
    await expect(beacon.locator(".nol-modules-state")).toHaveText(/Blocked/);
    await beacon.click();
    await expect(window.locator(".nol-modules-detail-title")).toHaveText("Beacon");
    await expect(window.locator(".nol-modules-fact-state")).toHaveText(/Blocked\s*It depends on reminder, which is not active\./);
  });
});
