/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";

const movedTitle = "Note 2, moved after the review of the window row";

function tab(window: Page, key: string): Locator {
  return window.locator(`nol-tab[data-tab-key="${key}"]`);
}

async function readTitlesAsync(mainProcess: MainProcessFixture): Promise<string[]> {
  const native = await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getTitle() ?? "");
  return [await mainProcess.window.title(), native];
}

async function expectTitledAsync(mainProcess: MainProcessFixture, title: string): Promise<void> {
  const product = await mainProcess.window.evaluate(() => document.title.split(" — ").at(-1) ?? "");
  await expect.poll(() => readTitlesAsync(mainProcess)).toEqual([`${title} — ${product}`, `${title} — ${product}`]);
}

test.describe("the window's title", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(tab(mainProcess.window, "document/notes.note/2")).toBeVisible();
  });

  test("names the window after the active document and follows it, and shows no heading in the window row, which holds the search field", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await tab(window, "document/notes.note/1").click();
    await expectTitledAsync(mainProcess, "Note 1");
    await expect(window.locator("nol-window-row .nol-window-row-heading, nol-window-row .nol-window-row-breadcrumb")).toHaveCount(0);
    await expect(window.locator("nol-window-row .nol-window-row-search")).toBeVisible();

    await tab(window, "document/notes.note/2").click();
    await expectTitledAsync(mainProcess, "Note 2");

    await SettingsFixture.openAsync(window);
    await expectTitledAsync(mainProcess, "Settings");
  });

  test.describe("in a window it sizes itself", () => {
    test.use({ mainProcessWindowPlacement: true });

    test("takes a module's new title, and in the smallest window keeps the search field inside the row's middle, its text cut with an ellipsis, with drag region on both sides", async ({ mainProcess }) => {
      const window = mainProcess.window;
      await tab(window, "document/notes.note/2").click();
      await CommandSearchFixture.searchAsync(window, "Move note 2 deep");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/notes.moveNote");
      await window.keyboard.press("Enter");

      await expect(tab(window, "document/notes.note/2").locator(".nol-tab-label")).toHaveText(movedTitle);
      await expectTitledAsync(mainProcess, movedTitle);
      await mainProcess.useWindowAsync(640, 480);
      const readAsync = (): Promise<{ isInside: boolean; cut: unknown[]; regions: string[] }> => window.locator("nol-window-row .nol-window-row-middle").evaluate(middle => {
        const field = middle.querySelector<HTMLElement>(".nol-window-row-search");
        const text = middle.querySelector<HTMLElement>(".nol-window-row-search-text");
        if (field === null || text === null)
          throw new Error("Nothing matches .nol-window-row-search in the row's middle.");
        const box = field.getBoundingClientRect();
        const edges = middle.getBoundingClientRect();
        const style = getComputedStyle(middle);
        const regionAt = (x: number): string => {
          let element = document.elementFromPoint(x, box.top + box.height / 2);
          while (element !== null && ["", "none"].includes(getComputedStyle(element).getPropertyValue("app-region")))
            element = element.parentElement;
          return element === null ? "none" : getComputedStyle(element).getPropertyValue("app-region");
        };
        return {
          isInside: box.left >= edges.left + parseFloat(style.paddingLeft) - 0.5 && box.right <= edges.right - parseFloat(style.paddingRight) + 0.5,
          cut: [text.scrollWidth > text.clientWidth, getComputedStyle(text).textOverflow],
          regions: [edges.left + 1, box.left + box.width / 2, edges.right - 1].map(regionAt)
        };
      });
      await expect.poll(async () => (await readAsync()).isInside, { message: "The row places the field inside its middle after the resize" }).toBe(true);
      const parts = await readAsync();

      expect(parts.isInside).toBe(true);
      expect(parts.cut[1]).toBe("ellipsis");
      expect(parts.regions).toEqual(["drag", "no-drag", "drag"]);
      await mainProcess.checkpointAsync("window-row-small");
    });
  });
});
