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
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { TabContentFixture } from "./fixtures/tab-content.fixture.ts";

async function setMenuBarAsync(window: Page, value: string): Promise<void> {
  await PageBridgeFixture.evaluateAsync(window, (t, menuBar) => t.request("desktop.setSetting", { name: "desktop.menuBar", value: menuBar }), value);
}

function bar(window: Page): Locator {
  return window.locator("nol-menu-bar");
}

function menuItem(window: Page, title: string): Locator {
  return bar(window).getByRole("menuitem", { name: title });
}

function button(window: Page): Locator {
  return window.locator(".nol-window-row-menu");
}

test.describe("the window row's menus on Windows and Linux", () => {
  test.skip(process.platform === "darwin", "macOS shows the menus in its own menu bar.");

  test.beforeEach(async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
  });

  test("inline, the menus are a menu bar at the row's start with the start actions after it, moved by the arrow keys", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const back = window.locator(".nol-window-row-start button[data-nol-item=\"notes.back\"]");
    const compose = window.locator(".nol-window-row-actions button[data-nol-item=\"notes.compose\"]");

    await expect(bar(window)).toHaveAttribute("role", "menubar");
    await expect(bar(window).getByRole("menuitem")).toHaveText([/File/, /Edit/, /View/, /Notes/, /Help/]);
    await expect(button(window)).toHaveCount(0);
    await expect(back).toHaveAttribute("aria-label", "Back");
    const [menus, start, end, row] = await Promise.all([bar(window).boundingBox(), back.boundingBox(), compose.boundingBox(), window.locator("nol-window-row").boundingBox()]);
    expect(menus?.x).toBeLessThan(start?.x ?? 0);
    expect((menus?.x ?? 0) + (menus?.width ?? 0)).toBeLessThanOrEqual(start?.x ?? 0);
    expect((start?.x ?? 0) + (start?.width ?? 0)).toBeLessThan(end?.x ?? 0);
    expect([menus?.y, menus?.height].every(t => (t ?? Infinity) <= (row?.height ?? 0))).toBe(true);
    expect(await menuItem(window, "File").evaluate(t => {
      const probe = document.body.appendChild(document.createElement("div"));
      probe.style.fontSize = "var(--nol-text-panel)";
      const panel = getComputedStyle(probe).fontSize;
      probe.remove();
      return [getComputedStyle(t).fontWeight, getComputedStyle(t).fontSize === panel];
    })).toEqual(["400", true]);
    await mainProcess.checkpointAsync("menu-bar-inline");

    await menuItem(window, "File").focus();
    await window.keyboard.press("ArrowRight");
    await expect(menuItem(window, "Edit")).toBeFocused();
    await window.keyboard.press("ArrowDown");
    await expect(window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.edit\"]")).toBeVisible();
    await expect(menuItem(window, "Edit")).toHaveAttribute("aria-expanded", "true");
    await window.keyboard.press("ArrowRight");
    await expect(window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.view\"]")).toBeVisible();
    await expect(window.locator(".cdk-overlay-container nol-menu")).toHaveCount(1);
    await menuItem(window, "Notes").hover();
    await expect(window.locator(".cdk-overlay-container nol-menu[data-place=\"notes.tools\"]")).toBeVisible();
    await expect(window.locator(".cdk-overlay-container nol-menu")).toHaveCount(1);
    await mainProcess.checkpointAsync("menu-bar-open");
    await window.keyboard.press("Escape");
    await expect(window.locator(".cdk-overlay-container nol-menu")).toHaveCount(0);

    await menuItem(window, "Edit").click();
    await expect(window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.edit\"]")).toBeVisible();
    await window.keyboard.press("Escape");
    await expect(window.locator(".cdk-overlay-container nol-menu")).toHaveCount(0);
    await expect(menuItem(window, "Edit")).toBeFocused();
  });

  test("F10 or a lone Alt focuses the menus, and Escape returns to the field that had the focus", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const note = await TabContentFixture.openAsync(window, "document/notes.note/1");
    const tag = note.getByRole("textbox", { name: "Tag" });
    await tag.click();

    await window.keyboard.press("F10");
    await expect(menuItem(window, "File")).toBeFocused();
    await window.keyboard.press("Escape");
    await expect(tag).toBeFocused();
    await window.keyboard.press("Alt");
    await expect(menuItem(window, "File")).toBeFocused();
    await window.keyboard.press("ArrowRight");
    await window.keyboard.press("Escape");
    await expect(tag).toBeFocused();
    await window.keyboard.press("Alt+KeyF");
    await expect(tag).toBeFocused();
    await mainProcess.checkpointAsync("menu-bar-keys");
  });

  test("a row too narrow for the bar folds it into the menu button, and the bar returns when the row can hold it", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const row = window.locator("nol-window-row");

    await row.evaluate(t => t.style.setProperty("width", "280px"));
    await expect(button(window)).toBeVisible();
    await expect(bar(window)).toBeHidden();
    await expect(bar(window)).toHaveAttribute("aria-hidden", "true");
    await mainProcess.checkpointAsync("menu-bar-folded");
    await button(window).click();
    await expect(window.locator("nol-menu.nol-window-row-menu-list button[nol-menu-item]")).toHaveText([/File/, /Edit/, /View/, /Notes/, /Help/]);
    await window.keyboard.press("Escape");
    await expect(button(window)).toBeFocused();
    await window.keyboard.press("Escape");
    await TabContentFixture.openAsync(window, "document/notes.note/1");
    await window.keyboard.press("F10");
    await expect(button(window)).toBeFocused();

    await row.evaluate(t => t.style.removeProperty("width"));
    await expect(bar(window)).toBeVisible();
    await expect(button(window)).toHaveCount(0);
  });

  test("as a button, the menus open from one menu button and the bar is gone", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await setMenuBarAsync(window, "Button");
    await expect(button(window)).toHaveAttribute("aria-label", "Menu");
    await expect(bar(window)).toHaveCount(0);
    await mainProcess.checkpointAsync("menu-bar-button");
    await button(window).click();
    await expect(window.locator("nol-menu.nol-window-row-menu-list button[nol-menu-item]")).toHaveText([/File/, /Edit/, /View/, /Notes/, /Help/]);
    await window.keyboard.press("Escape");

    await setMenuBarAsync(window, "Inline");
    await expect(bar(window)).toBeVisible();
    await expect(button(window)).toHaveCount(0);
  });

  test("hidden, the row has no menus at all, F10 does nothing and the commands stay in command search", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const note = await TabContentFixture.openAsync(window, "document/notes.note/1");
    const tag = note.getByRole("textbox", { name: "Tag" });
    await tag.click();

    await setMenuBarAsync(window, "Hidden");
    await expect(bar(window)).toHaveCount(0);
    await expect(button(window)).toHaveCount(0);
    await window.keyboard.press("F10");
    await expect(tag).toBeFocused();
    await CommandSearchFixture.searchAsync(window, "new n");
    await expect(window.locator(".cdk-overlay-container .nol-search-pane [role=option][data-item=\"desktop.commands/notes.newNote\"] mark")).toHaveText(["New n"]);
    await mainProcess.checkpointAsync("menu-bar-hidden");
    await window.keyboard.press("Escape");

    await setMenuBarAsync(window, "Inline");
    await expect(bar(window)).toBeVisible();
  });
});
