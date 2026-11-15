/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Locator } from "@playwright/test";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";
import { TabContentFixture } from "./fixtures/tab-content.fixture.ts";

test.describe("text field menu", () => {
  test("a right click on a field opens Cut, Copy, Paste and Select all with only what applies enabled, Shift+F10 opens it by keyboard, and its rows edit the field through the system clipboard", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openAsync(window);
    const search = window.getByRole("searchbox", { name: "Search settings" });
    const menu = window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.field\"]");
    const row = (name: string) => menu.getByRole("menuitem", { name });
    await search.fill("size");

    await search.click({ button: "right" });

    await expect(menu.getByRole("menuitem")).toHaveText([/Cut/, /Copy/, /Paste/, /Select all/]);
    await expect(row("Cut")).toHaveAttribute("aria-disabled", "true");
    await expect(row("Copy")).toHaveAttribute("aria-disabled", "true");
    await expect(row("Paste")).not.toHaveAttribute("aria-disabled", "true");
    await mainProcess.checkpointAsync("field-menu");
    await row("Select all").click();
    await expect(menu).toHaveCount(0);
    await expect(search).toBeFocused();

    await search.press("Shift+F10");

    await expect(row("Cut")).toBeFocused();
    await expect(row("Copy")).not.toHaveAttribute("aria-disabled", "true");
    await window.keyboard.press("Enter");
    await expect(menu).toHaveCount(0);
    await expect(search).toHaveValue(String.empty);
    await expect(search).toBeFocused();
    expect(await mainProcess.application.evaluate(({ clipboard }) => clipboard.readText())).toBe("size");

    await search.click({ button: "right" });
    await row("Paste").click();

    await expect(search).toHaveValue("size");
  });

  test("a right click on a misspelled word offers the spell checker's suggestions first, then Add to dictionary, and the first replaces the word; on Linux, Noldova Desktop Sample's own dictionary suggests world and takes a word", async ({ mainProcess }) => {
    const firstCheck = process.platform === "win32" ? 60000 : 20000;
    test.setTimeout(firstCheck + 60000);
    const window = mainProcess.window;
    const note = await TabContentFixture.openAsync(window, "document/notes.note/1");
    const summary = note.getByRole("textbox", { name: "Summary" });
    const menu = window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.field\"]");
    const rows = menu.getByRole("menuitem");
    const add = menu.getByRole("menuitem", { name: "Add to dictionary" });
    const suggestions = menu.locator(".nol-place-menu-item[data-command=\"desktop.replaceMisspelling\"]:not([aria-disabled=\"true\"])");
    const openOnWordAsync = async (word: string, ready: Locator): Promise<void> => {
      await expect(async () => {
        if (await menu.count() > 0)
          await window.keyboard.press("Escape");
        await summary.fill(String.empty);
        await summary.fill(word);
        await summary.click({ button: "right", position: await middleOfTextAsync(summary) });
        await expect(ready).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: firstCheck });
    };

    await openOnWordAsync("wrold ", suggestions.first());

    await expect(rows.first()).toHaveAttribute("data-command", "desktop.replaceMisspelling");
    if (process.platform === "linux")
      await expect(suggestions.first().locator(".nol-menu-item-label")).toHaveText("world");
    await expect(add).toHaveCount(1);
    await expect(rows.filter({ hasText: /Cut$/ })).toHaveCount(1);
    await mainProcess.checkpointAsync("field-menu-spelling");
    const suggestion = await suggestions.first().locator(".nol-menu-item-label").textContent() ?? String.empty;
    await suggestions.first().click();
    await expect(menu).toHaveCount(0);
    await expect(summary).toHaveValue(`${suggestion} `);
    await expect(summary).toBeFocused();
    if (process.platform !== "linux")
      return;

    await openOnWordAsync("zqxwvj ", rows.first().filter({ hasText: "No suggestions" }));
    await expect(rows.first()).toHaveAttribute("aria-disabled", "true");
    await add.click();
    await expect(summary).toBeFocused();

    await expect(async () => {
      if (await menu.count() > 0)
        await window.keyboard.press("Escape");
      await summary.click({ button: "right", position: await middleOfTextAsync(summary) });
      await expect(rows.first()).toHaveText(/Cut/, { timeout: 2000 });
    }).toPass({ timeout: 20000 });
  });
});

async function middleOfTextAsync(field: Locator): Promise<{ x: number; y: number }> {
  return field.evaluate((element: HTMLTextAreaElement) => {
    const style = getComputedStyle(element);
    const context = document.createElement("canvas").getContext("2d");
    if (context !== null)
      context.font = style.font;
    const width = context?.measureText(element.value.trim()).width ?? 0;
    return { x: element.clientLeft + Number.parseFloat(style.paddingLeft) + width / 2, y: element.clientTop + Number.parseFloat(style.paddingTop) + Number.parseFloat(style.fontSize) / 2 };
  });
}
