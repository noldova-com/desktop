/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { LayoutFixture } from "./fixtures/layout.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";

const DEFAULT_PANEL_SIZE = 13;
const SCALE_TOLERANCE = 0.5;
const POINTER_TARGET = 24;

async function setSizesAsync(window: Page, panel: number, message = panel, code = panel): Promise<void> {
  await PageBridgeFixture.evaluateAsync(window, async (t, sizes) => {
    for (const [name, value] of sizes)
      await t.request("desktop.setSetting", { name, value });
  }, [["desktop.panelSize", panel], ["desktop.messageSize", message], ["desktop.codeSize", code]] as const);
  await expect.poll(() => window.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(16 * panel / DEFAULT_PANEL_SIZE, 2);
  await expect.poll(() => window.evaluate(() => ["--nol-text-message", "--nol-text-code"].map(t => getComputedStyle(document.documentElement).getPropertyValue(t)))).toEqual([`${message}px`, `${code}px`]);
}

async function measureAsync(window: Page): Promise<{ sizes: Record<string, number>; borders: Record<string, number>; windowRow: number; iconButton: number; rem: number }> {
  return await window.evaluate(() => {
    const find = (selector: string): Element => {
      const element = document.querySelector(selector);
      if (element === null)
        throw new Error(`Nothing matches ${selector}.`);
      return element;
    };
    const height = (selector: string): number => find(selector).getBoundingClientRect().height;
    const style = (selector: string): CSSStyleDeclaration => getComputedStyle(find(selector));
    return {
      sizes: {
        statusBar: height("nol-status-bar"),
        tab: height("nol-tab"),
        tabStart: parseFloat(style("nol-tab").paddingInlineStart),
        statusBarItem: height("nol-status-bar-item .nol-status-bar-item"),
        statusBarItemStart: parseFloat(style("nol-status-bar-item .nol-status-bar-item").paddingInlineStart),
        toolbarButton: height("nol-toolbar button")
      },
      borders: {
        tabGroupCard: parseFloat(style(".nol-tab-group-card").borderTopWidth),
        statusBar: parseFloat(style("nol-status-bar").borderTopWidth)
      },
      windowRow: height("nol-window-row"),
      iconButton: height(".nol-window-row-settings"),
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize)
    };
  });
}

async function checkSizeAsync(window: Page, size: number): Promise<void> {
  const base = await measureAsync(window);
  await setSizesAsync(window, size);
  const measured = await measureAsync(window);

  const ratio = size / DEFAULT_PANEL_SIZE;
  expect(Object.entries(measured.sizes).filter(([name, value]) => Math.abs(value - (base.sizes[name] ?? 0) * ratio) > SCALE_TOLERANCE)
    .map(([name, value]) => `${name}: ${value} px at ${size}, ${base.sizes[name]} px at ${DEFAULT_PANEL_SIZE}`)).toEqual([]);
  expect(measured.borders).toEqual(base.borders);
  expect(Math.abs(measured.windowRow - (Math.max(measured.iconButton, POINTER_TARGET) + measured.rem / 2))).toBeLessThanOrEqual(SCALE_TOLERANCE);
  expect(await LayoutFixture.findProblemsAsync(window.locator("nol-window-row, nol-status-bar, .nol-tab-group-bar"))).toEqual([]);
  expect(await LayoutFixture.findCutTextAsync(window.locator("nol-window-row, nol-status-bar, .nol-tab-group-bar"))).toEqual([]);
}

async function checkSettingsAsync(window: Page): Promise<void> {
  await SettingsFixture.openAsync(window);
  const settings = window.locator("nol-settings");

  for (const title of ["General", "Appearance"]) {
    await SettingsFixture.choosePageAsync(window, title);
    expect(await LayoutFixture.findProblemsAsync(settings)).toEqual([]);
    expect(await LayoutFixture.findCutTextAsync(settings)).toEqual([]);
  }
}

test.describe("the smallest and largest text", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
  });

  test("at size 12, the window's geometry scales with the panel size, the window row keeps room for a 24px pointer target, its borders keep their width, and its controls and Settings' stay inside the window, uncovered and uncut", async ({ mainProcess }) => {
    await checkSizeAsync(mainProcess.window, 12);
    await mainProcess.checkpointAsync("text-size-smallest");
    await checkSettingsAsync(mainProcess.window);
    await mainProcess.checkpointAsync("text-size-smallest-settings");
  });

  test("at size 18, the window's geometry scales with the panel size, the window row keeps room for a 24px pointer target, its borders keep their width, and its controls and Settings' stay inside the window, uncovered and uncut", async ({ mainProcess }) => {
    await checkSizeAsync(mainProcess.window, 18);
    await mainProcess.checkpointAsync("text-size-largest");
    await checkSettingsAsync(mainProcess.window);
    await mainProcess.checkpointAsync("text-size-largest-settings");
  });
});

test.describe("message and code text", () => {
  test.use({ mainProcessDataFiles: { "modules/notes/feed": String.empty } });

  for (const [messageSize, codeSize] of [[12, 18], [18, 12]]) {
    test(`take their own sizes, message ${messageSize} and code ${codeSize}, with the panel at ${DEFAULT_PANEL_SIZE}`, async ({ mainProcess }) => {
      const window = mainProcess.window;
      await window.locator("nol-tab[data-tab-key=\"document/notes.feed/messages\"]").click();
      const content = window.locator("[data-tab-content=\"document/notes.feed/messages\"]");
      const message = content.locator(".nol-message").last();
      const code = content.locator(".nol-code-block-body").last();
      await expect(code).toBeVisible();

      await setSizesAsync(window, DEFAULT_PANEL_SIZE, messageSize, codeSize);
      await expect(message).toHaveCSS("font-size", `${messageSize}px`);
      await expect(code).toHaveCSS("font-size", `${codeSize}px`);
      await mainProcess.checkpointAsync(`text-size-feed-message-${messageSize}-code-${codeSize}`);
    });
  }
});
