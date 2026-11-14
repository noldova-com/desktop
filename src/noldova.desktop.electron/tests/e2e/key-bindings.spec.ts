/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

const isMac = process.platform === "darwin";
function label(standard: string, mac: string): string {
  return isMac ? mac : standard;
}

function shortcut(window: Page, command: string): Locator {
  return window.locator(`nol-shortcuts tr[data-command="${command}"]`);
}

function keyOf(window: Page, command: string): Locator {
  return shortcut(window, command).locator(".nol-shortcut-key");
}

function note(window: Page, id: number): Locator {
  return window.locator(`nol-tab[data-tab-key="document/notes.note/${id}"]`);
}

async function openShortcutsAsync(window: Page): Promise<void> {
  await SettingsFixture.openPageAsync(window, "Keyboard shortcuts");
  await expect(keyOf(window, "notes.newNote")).toBeVisible();
}

async function recordAsync(window: Page, command: string, keys: string): Promise<void> {
  await keyOf(window, command).click();
  await expect(keyOf(window, command)).toHaveText("Press the new key");
  await window.keyboard.press(keys);
}

test.describe("key bindings", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(note(mainProcess.window, 2)).toBeVisible();
  });

  test("a key recorded on Keyboard shortcuts runs its command instead of the default, shows in menus and command search, and outlives a restart", async ({ mainProcess }) => {
    let window = mainProcess.window;
    await openShortcutsAsync(window);

    await recordAsync(window, "notes.newNote", "ControlOrMeta+Shift+KeyY");

    await expect(keyOf(window, "notes.newNote")).toHaveText(label("Ctrl+Shift+Y", "⇧⌘Y"));
    await expect(keyOf(window, "notes.newNote")).toBeFocused();
    await expect(shortcut(window, "notes.newNote").getByRole("img", { name: "Modified" })).toBeVisible();
    await mainProcess.checkpointAsync("key-bindings-recorded");

    await window.locator("[data-fixture-content=notes-list]").click();
    await window.keyboard.press("ControlOrMeta+Alt+KeyN");
    await window.keyboard.press("ControlOrMeta+Shift+KeyY");
    await expect(note(window, 3)).toBeVisible();

    await CommandSearchFixture.searchAsync(window, "New note");
    await expect(window.locator(".nol-search-pane [data-item=\"desktop.commands/notes.newNote\"] .nol-quick-input-key")).toHaveText(label("Ctrl+Shift+Y", "⇧⌘Y"));
    await window.keyboard.press("Escape");
    if (isMac) {
      await expect.poll(() => mainProcess.application.evaluate(({ Menu }) => String(Menu.getApplicationMenu()?.getMenuItemById("desktop.file/notes.create/0")?.accelerator)))
        .toBe("Shift+Command+Y");
    }
    else {
      await window.locator("nol-menu-bar").getByRole("menuitem", { name: "File" }).click();
      await expect(window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.file\"] button[data-command=\"notes.newNote\"] .nol-menu-item-shortcut").first())
        .toHaveText("Ctrl+Shift+Y");
      await window.keyboard.press("Escape");
    }
    await expect(window.locator("nol-tab[data-tab-key^=\"document/notes.note/\"]")).toHaveCount(3);

    await mainProcess.restartAsync();
    window = mainProcess.window;
    await expect(note(window, 2)).toBeVisible();
    await openShortcutsAsync(window);
    await expect(keyOf(window, "notes.newNote")).toHaveText(label("Ctrl+Shift+Y", "⇧⌘Y"));
  });

  test("a key another command holds moves on Use it here, a reserved key is refused with the reason, and Reset and Reset all return the defaults", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const ticks = window.locator("[data-fixture-content=clock-ticks]");
    await expect(ticks).toHaveText("No ticks");
    await openShortcutsAsync(window);

    await recordAsync(window, "notes.newNote", "ControlOrMeta+KeyC");
    await expect(shortcut(window, "notes.newNote").getByRole("alert")).toHaveText(label("Ctrl+C belongs to editing", "⌘C belongs to editing"));
    await expect(keyOf(window, "notes.newNote")).toHaveText(label("Ctrl+Alt+N", "⌥⌘N"));

    const keyColumn = (await keyOf(window, "clock.tick").boundingBox())?.x;
    await recordAsync(window, "notes.newNote", "ControlOrMeta+Alt+KeyT");
    await expect(shortcut(window, "notes.newNote").getByRole("alert")).toContainText(label("Ctrl+Alt+T is used by Tick", "⌥⌘T is used by Tick"));
    expect((await keyOf(window, "clock.tick").boundingBox())?.x).toBe(keyColumn);
    for (const mode of WindowModeFixture.modes) {
      await WindowModeFixture.setAsync(window, mode);
      await mainProcess.checkpointAsync(`key-bindings-collision-${mode.toLowerCase()}`);
    }
    await shortcut(window, "notes.newNote").getByRole("button", { name: "Use it here" }).click();

    await expect(keyOf(window, "notes.newNote")).toHaveText(label("Ctrl+Alt+T", "⌥⌘T"));
    await expect(keyOf(window, "notes.newNote")).toBeFocused();
    await expect(keyOf(window, "clock.tick")).toHaveText("No key");
    await expect(shortcut(window, "clock.tick").getByRole("button", { name: "Reset Tick" })).toBeVisible();
    await window.locator("[data-fixture-content=notes-list]").click();
    await window.keyboard.press("ControlOrMeta+Alt+KeyT");
    await expect(note(window, 3)).toBeVisible();

    await window.locator("nol-tab[data-tab-key=\"document/desktop.settings\"]").click();
    await window.getByRole("treeitem", { name: "Keyboard shortcuts", exact: true }).click();
    await shortcut(window, "clock.tick").getByRole("button", { name: "Reset Tick" }).click();
    await expect(keyOf(window, "clock.tick")).toHaveText("No key");
    await expect(shortcut(window, "clock.tick").locator(".nol-shortcut-collision")).toHaveText(label("Ctrl+Alt+T is taken by New note", "⌥⌘T is taken by New note"));
    await expect(ticks).toHaveText("No ticks");
    await recordAsync(window, "clock.tick", label("Control+PageDown", "Control+Tab"));
    await expect(shortcut(window, "clock.tick").getByRole("alert")).toContainText("is used by Show the next tab");
    await shortcut(window, "clock.tick").getByRole("button", { name: "Use it here" }).click();
    await expect(keyOf(window, "desktop.nextTab")).toHaveText(label("Ctrl+Tab", "⌥⌘→"));
    await expect(shortcut(window, "desktop.nextTab").locator(".nol-shortcut-collision")).toContainText(label("Ctrl+PageDown is taken by Tick", "⌃⇥ is taken by Tick"));
    await CommandSearchFixture.searchAsync(window, "Show the next tab");
    await expect(window.locator(".nol-search-pane [data-item=\"desktop.commands/desktop.nextTab\"] .nol-quick-input-key")).toHaveText(label("Ctrl+Tab", "⌥⌘→"));
    await window.keyboard.press("Escape");
    await window.keyboard.press(label("Control+PageDown", "Control+Tab"));
    await expect(ticks).toHaveText("Ticks: 1");
    await window.getByRole("button", { name: "Reset all shortcuts" }).click();
    await expect(keyOf(window, "notes.newNote")).toHaveText(label("Ctrl+Alt+N", "⌥⌘N"));
    await expect(keyOf(window, "clock.tick")).toHaveText(label("Ctrl+Alt+T", "⌥⌘T"));
    await expect(window.getByRole("button", { name: "Reset all shortcuts" })).toBeDisabled();
    await expect(window.locator("nol-shortcuts .nol-shortcut-marker")).toHaveCount(0);
  });
});
