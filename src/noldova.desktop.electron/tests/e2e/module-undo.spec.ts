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
import { TabContentFixture } from "./fixtures/tab-content.fixture.ts";

test.use({ mainProcessDataFiles: { "modules/notes/undo": String.empty } });

function count(window: Page): Locator {
  return window.locator("nol-status-bar-item[data-nol-item=\"notes.count\"]");
}

test.describe("a module's own Undo", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(count(mainProcess.window)).toHaveText("2 notes");
    await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus());
  });

  test.describe("on Windows and Linux", () => {
    test.skip(process.platform === "darwin", "macOS takes Cmd+Z in its own menu bar.");

    test("Ctrl+Z in a field undoes its typing, off a field it runs the module's undo, and Edit → Undo greys once the module has nothing to undo", async ({ mainProcess }) => {
      const window = mainProcess.window;
      const note = await TabContentFixture.openAsync(window, "document/notes.note/1");
      const summary = note.getByRole("textbox", { name: "Summary", exact: true });
      const wrap = note.getByRole("button", { name: "Wrap this note", exact: true });
      const edit = window.locator("nol-menu-bar").getByRole("menuitem", { name: "Edit", exact: true });
      const undo = window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.edit\"]").getByRole("menuitem", { name: "Undo", exact: true });

      await summary.click();
      await summary.pressSequentially("ab");
      await summary.press("Control+Z");

      await expect(summary).toHaveValue(String.empty);
      await expect(count(window)).toHaveText("2 notes");

      await wrap.focus();
      await edit.click();
      await expect(undo).not.toHaveAttribute("aria-disabled", "true");
      await window.keyboard.press("Escape");
      await wrap.focus();
      await window.keyboard.press("Control+Z");

      await expect(count(window)).toHaveText("Undone 1");
      await expect(summary).toHaveValue(String.empty);
      await edit.click();
      await expect(undo).toHaveAttribute("aria-disabled", "true");
    });
  });

  test.describe("on macOS", () => {
    test.skip(process.platform !== "darwin", "Windows and Linux show the Edit menu in the window.");

    test("the menu bar's Undo row with Cmd+Z runs the module's undo while no field has the focus, greys once it has nothing to undo, and gives way to the native Undo in a field", async ({ mainProcess }) => {
      const window = mainProcess.window;
      const note = await TabContentFixture.openAsync(window, "document/notes.note/1");
      const readUndo = (): Promise<readonly [string, string | null, boolean, string | null] | null> => mainProcess.application.evaluate(({ Menu }) => {
        const item = Menu.getApplicationMenu()?.items.find(t => t.label === "Edit")?.submenu?.items[0];
        return item ? [item.id, item.role ?? null, item.enabled, item.accelerator ?? null] as const : null;
      });

      await note.getByRole("button", { name: "Wrap this note", exact: true }).focus();
      await expect.poll(readUndo).toEqual(["desktop.undo", null, true, "CmdOrCtrl+Z"]);
      await mainProcess.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("desktop.undo")?.click());

      await expect(count(window)).toHaveText("Undone 1");
      await expect.poll(readUndo).toEqual(["desktop.undo", null, false, "CmdOrCtrl+Z"]);

      await note.getByRole("textbox", { name: "Summary", exact: true }).focus();

      await expect.poll(async () => (await readUndo())?.[1]).toBe("undo");
    });
  });
});
