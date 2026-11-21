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
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";
import { TabDragFixture } from "./fixtures/tab-drag.fixture.ts";

async function systemColorAsync(window: Page, name: string): Promise<string> {
  return window.evaluate(color => {
    const probe = document.body.appendChild(document.createElement("span"));
    probe.style.color = color;
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, name);
}

async function styleAsync(target: Locator, property: string, part: string | null = null): Promise<string> {
  return target.evaluate((element, [name, pseudo]) => getComputedStyle(element, pseudo).getPropertyValue(String(name)), [property, part] as const);
}

interface IFontReading {
  readonly width: number;
  readonly fallbackWidth: number;
  readonly isKitFontLoaded: boolean;
}

async function fontOfAsync(target: Locator): Promise<IFontReading> {
  return target.evaluate(element => {
    const measure = (): number => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().width;
    };
    const style = getComputedStyle(element);
    const [kitFamily = "", ...fallbacks] = style.fontFamily.split(",").map(t => t.trim());
    const width = measure();
    const family = element.style.fontFamily;
    element.style.fontFamily = fallbacks.join(", ");
    const fallbackWidth = measure();
    element.style.fontFamily = family;
    const isKitFontLoaded = [...document.fonts].some(t => t.family.replaceAll("\"", "") === kitFamily.replaceAll("\"", "") && t.status === "loaded");
    return { width, fallbackWidth, isKitFontLoaded };
  });
}

test.describe("forced colors", () => {
  test("keep the current page, the selected tab, the current module, separators, grips and hover visible in the system's colors, light and dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openAsync(window);
    await MediaFixture.emulateAsync(window, { forcedColors: "active", colorScheme: "light" });
    const highlight = await systemColorAsync(window, "Highlight");
    const text = await systemColorAsync(window, "HighlightText");
    const canvasText = await systemColorAsync(window, "CanvasText");
    const page = window.locator("nol-settings .nol-tree-row-current");
    const tab = window.locator(".nol-tab.nol-tab-selected .nol-tab-pill").first();
    const item = window.locator("button.nol-notifications-item");

    await expect(page).toHaveCSS("background-color", highlight);
    await expect(page.locator(".nol-tree-label")).toHaveCSS("color", text);
    await expect(tab).toHaveCSS("background-color", highlight);
    await expect(window.locator(".nol-toolbar-dot").first()).toHaveCSS("background-color", canvasText);
    await expect(window.locator(".nol-toolbar-separator").first()).toHaveCSS("background-color", canvasText);
    await item.hover();
    expect([await styleAsync(item, "outline-style"), await styleAsync(item, "outline-color")]).toEqual(["dashed", highlight]);
    await window.mouse.move(1, 1);
    await mainProcess.checkpointAsync("forced-colors-settings-light");

    await MediaFixture.emulateAsync(window, { forcedColors: "active", colorScheme: "dark" });
    await CommandSearchFixture.searchAsync(window, "Modules");
    await window.keyboard.press("Enter");
    const current = window.locator(".nol-modules-row-current");
    await expect(current).toBeVisible();

    await expect(current).toHaveCSS("background-color", await systemColorAsync(window, "Highlight"));
    await expect(current).toHaveCSS("color", await systemColorAsync(window, "HighlightText"));
    await mainProcess.checkpointAsync("forced-colors-modules-dark");
  });

  test("keep a text in the kit's font at its width right after each media switch, where the fallback font's width differs", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openAsync(window);
    const label = window.locator("nol-settings .nol-tree-row-current .nol-tree-label");
    await expect(label).toBeVisible();
    await window.evaluate(async () => {
      await document.fonts.ready;
    });
    const before = await fontOfAsync(label);
    const switches: readonly Parameters<Page["emulateMedia"]>[0][] = [{ forcedColors: "active" }, { forcedColors: "none" }, { colorScheme: "dark" }, { colorScheme: "light" }];
    const after: IFontReading[] = [];
    for (const media of switches) {
      await MediaFixture.emulateAsync(window, media);
      after.push(await fontOfAsync(label));
    }

    expect([before.isKitFontLoaded, before.fallbackWidth !== before.width]).toEqual([true, true]);
    expect(after.map(t => t.width)).toEqual(switches.map(() => before.width));
  });

  test("give scroll areas the system's scrollbars", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openAsync(window);
    const content = window.locator("nol-settings .nol-settings-content");
    const gutterAsync = (): Promise<number> => content.evaluate(t => t instanceof HTMLElement ? t.offsetWidth - t.clientWidth : Number.NaN);
    const thin = await gutterAsync();

    await MediaFixture.emulateAsync(window, { forcedColors: "active" });

    await expect.poll(gutterAsync).not.toBe(thin);
  });

  test("give a tab row no scrollbar, whether its tabs fit or overflow, let each tab it shows take a click, and never scroll an overflowing row by wheel", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const firstNote = "document/notes.note/1";
    const rowsAsync = (): Promise<{ bar: number; isOverflowing: boolean }[]> => window.locator(".nol-tab-group-scroller").evaluateAll(t => t
      .filter(u => u.getBoundingClientRect().height > 0)
      .map(u => ({ bar: u instanceof HTMLElement ? u.offsetHeight - u.clientHeight : Number.NaN, isOverflowing: u.querySelector(".nol-tab-overflowed") !== null })));
    await MediaFixture.emulateAsync(window, { forcedColors: "active" });
    await expect(TabDragFixture.tab(window, firstNote)).toBeVisible();
    const fitting = await rowsAsync();
    await mainProcess.useViewportAsync(640, 480);
    const group = TabDragFixture.groupOf(window, firstNote);
    const scroller = group.locator(".nol-tab-group-scroller");
    const tabs = group.locator("nol-tab");
    await TabDragFixture.tab(window, firstNote).click();
    for (let count = await tabs.count(); count < 8; count++) {
      await window.keyboard.press("ControlOrMeta+Alt+KeyN");
      await expect(tabs).toHaveCount(count + 1);
    }
    await expect.poll(() => group.locator(".nol-tab-overflowed").count(), { message: "The note row hides a tab" }).toBeGreaterThan(0);
    const rows = [...fitting, ...await rowsAsync()];

    expect(rows.map(t => t.bar)).toEqual(rows.map(() => 0));
    expect([fitting.length > 0 && fitting.every(t => !t.isOverflowing), rows.some(t => t.isOverflowing)]).toEqual([true, true]);
    for (const tab of await group.locator("nol-tab:not(.nol-tab-overflowed)").all()) {
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
    }
    await scroller.hover();
    await window.mouse.wheel(200, 0);
    await window.mouse.wheel(0, 200);
    expect(await scroller.evaluate(t => t.scrollLeft)).toBe(0);
    await mainProcess.checkpointAsync("forced-colors-tab-rows");
  });
});
