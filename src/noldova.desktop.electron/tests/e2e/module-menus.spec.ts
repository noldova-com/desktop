/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";

function noteView(window: Page, instance: string): Locator {
  return window.locator("nol-notes-note", { has: window.locator(`[data-fixture-content="notes-note-${instance}"]`) });
}

async function installClockAsync(window: Page): Promise<void> {
  await window.evaluate(() => {
    const clearTimer = clearTimeout;
    const clearRepeat = clearInterval;
    const cancelFrame = cancelAnimationFrame;
    const cancelIdle = cancelIdleCallback;
    const natives: readonly (readonly [string, (id?: number) => void])[] = [
      ["clearTimeout", id => clearTimer(id)],
      ["clearInterval", id => clearRepeat(id)],
      ["cancelAnimationFrame", id => cancelFrame(id ?? 0)],
      ["cancelIdleCallback", id => cancelIdle(id ?? 0)]
    ];
    for (const [name, native] of natives) {
      let current = native;
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get: () => current,
        set: (faked: (id?: number) => void) => {
          current = (id?: number): void => {
            faked(id);
            native(id);
          };
        }
      });
    }
  });
  await window.clock.install();
}

async function openBarMenuAsync(window: Page, title: string): Promise<Locator> {
  await window.locator("nol-menu-bar").getByRole("menuitem", { name: title }).click();
  const menu = window.locator(".cdk-overlay-container nol-menu.nol-place-menu").last();
  await expect(menu).toBeVisible();
  return menu;
}

test.describe("the inline menu bar on Windows and Linux", () => {
  test.skip(process.platform === "darwin", "macOS shows the menus in its own menu bar.");

  test("the menu bar opens File, Edit, View and the modules' menus, and runs their rows with their checked state @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const list = window.locator(".nol-notes-list-items");
    const bar = window.locator("nol-menu-bar");
    await expect(bar).toHaveAttribute("aria-label", "Menus");
    await expect(bar.getByRole("menuitem")).toHaveText([/File/, /Edit/, /View/, /Notes/, /Help/]);
    await expect(window.locator(".nol-window-row-menu")).toHaveCount(0);

    const file = await openBarMenuAsync(window, "File");
    await expect(file.locator("button[nol-menu-item]")).toHaveText([/Close the tab/, /New note/, /New from template/]);
    await file.getByRole("menuitem", { name: "New note" }).click();
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/3\"] .nol-tab-label")).toHaveText("Note 3");
    await (await openBarMenuAsync(window, "Notes")).getByRole("menuitemradio", { name: "Sort by title" }).click();
    await expect(list).toHaveAttribute("data-sort", "title");
    const spans = await openBarMenuAsync(window, "View");
    await expect(spans.getByRole("menuitemradio", { name: "Bottom dock across the window" })).toHaveAttribute("aria-checked", "true");
    await spans.getByRole("menuitemradio", { name: "Bottom dock between the side docks" }).click();
    await expect((await openBarMenuAsync(window, "View")).getByRole("menuitemradio", { name: "Bottom dock between the side docks" })).toHaveAttribute("aria-checked", "true");
    await window.keyboard.press("Escape");
    await window.keyboard.press("Escape");
    const view = await openBarMenuAsync(window, "View");
    await expect(view.getByRole("menuitemcheckbox", { name: "Left dock" })).toHaveAttribute("aria-checked", "true");
    await view.getByRole("menuitemcheckbox", { name: "Left dock" }).click();
    await expect((await openBarMenuAsync(window, "View")).getByRole("menuitemcheckbox", { name: "Left dock" })).toHaveAttribute("aria-checked", "false");
    await window.keyboard.press("Escape");
    await window.keyboard.press("Escape");

    await expect(window.locator(".cdk-overlay-container nol-menu")).toHaveCount(0);
    await expect(list).toHaveCount(0);
    await expect(bar.getByRole("menuitem", { name: "View" })).toBeFocused();
  });

  test("the Edit menu copies from one field and pastes into another, acting on the field that had focus and its selection", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]").click();
    const tag = noteView(window, "1").getByRole("textbox", { name: "Tag" });
    const summary = noteView(window, "1").getByRole("textbox", { name: "Summary" });
    await tag.selectText();

    await (await openBarMenuAsync(window, "Edit")).getByRole("menuitem", { name: "Copy" }).click();
    await expect(tag).toBeFocused();
    expect(await tag.evaluate(t => t instanceof HTMLInputElement ? [t.selectionStart, t.selectionEnd] : [])).toEqual([0, 5]);
    await summary.click();
    const edit = await openBarMenuAsync(window, "Edit");
    await expect(edit.getByRole("menuitem", { name: "Cut" })).toHaveAttribute("aria-disabled", "true");
    await edit.getByRole("menuitem", { name: "Paste" }).click();
    await expect(summary).toHaveValue("draft");
    await (await openBarMenuAsync(window, "Edit")).getByRole("menuitem", { name: "Undo" }).click();

    await expect(summary).toHaveValue(String.empty);
    await expect(summary).toBeFocused();
  });
});

test.describe("the menu bar on macOS", () => {
  test.skip(process.platform !== "darwin", "Windows and Linux show the menus in the window row.");

  test("the native menu bar holds the shell's and the modules' menus, shows checked state and runs a chosen row in the window @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const read = (id: string): Promise<readonly [boolean, boolean] | null> => mainProcess.application.evaluate(({ Menu }, itemId) => {
      const item = Menu.getApplicationMenu()?.getMenuItemById(itemId);
      return item ? [item.enabled, item.checked] as const : null;
    }, id);

    await expect.poll(() => mainProcess.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items.map(t => t.label) ?? []))
      .toEqual([expect.any(String), "File", "Edit", "View", "Notes", "Window", "Help"]);
    await expect.poll(() => read("notes.tools/notes.toolsSorting/1")).toEqual([true, true]);
    await mainProcess.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("desktop.file/notes.create/0")?.click());
    await mainProcess.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("notes.tools/notes.toolsSorting/0")?.click());

    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/3\"] .nol-tab-label")).toHaveText("Note 3");
    await expect(window.locator(".nol-notes-list-items")).toHaveAttribute("data-sort", "title");
    await expect.poll(() => read("notes.tools/notes.toolsSorting/0")).toEqual([true, true]);
    await expect.poll(() => read("notes.tools/notes.toolsSorting/1")).toEqual([true, false]);
  });
});

test.describe("a note's fields", () => {
  test("are found in the clicked note's view, never in the view it replaces while the window has not rendered the switch", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const tag = noteView(window, "1").getByRole("textbox", { name: "Tag" });
    await expect(noteView(window, "2")).toBeVisible();
    await installClockAsync(window);
    await window.clock.pauseAt(Date.now() + 1000);

    await window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]").click();
    await expect(noteView(window, "2").getByRole("textbox", { name: "Tag" })).toBeAttached();
    await expect(tag).toHaveCount(0);
    const selecting = tag.selectText();
    await window.clock.resume();
    await selecting;

    await expect(noteView(window, "2")).toBeHidden();
    expect(await tag.evaluate(t => t instanceof HTMLInputElement ? [t.selectionStart, t.selectionEnd] : [])).toEqual([0, 5]);
  });
});
