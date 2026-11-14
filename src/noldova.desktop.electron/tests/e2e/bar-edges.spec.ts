/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";

interface IBarEdges {
  readonly panels: readonly [number, number];
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly controlsStart: number;
  readonly statusStart: number;
  readonly statusEnd: number;
}

async function edgesAsync(window: Page): Promise<IBarEdges> {
  await expect(window.locator(".nol-tab-group-card").first()).toBeVisible();
  await expect(window.locator("nol-window-row .nol-window-row-search")).toBeVisible();
  return window.evaluate(() => {
    const boxes = (selector: string): DOMRect[] => [...document.querySelectorAll(selector)].map(t => t.getBoundingClientRect()).filter(t => t.width > 0);
    const cards = boxes(".nol-tab-group-card");
    const row = document.querySelector<HTMLElement>("nol-window-row");
    if (row === null)
      throw new Error("Nothing matches nol-window-row.");
    const first = [...row.querySelectorAll(".nol-window-row-menu-bar:not(.nol-window-row-menu-bar-folded) .nol-window-row-menu-bar-item, .nol-window-row-menu, .nol-window-row-start")][0];
    const overlay = navigator.windowControlsOverlay;
    const area = overlay?.visible === true ? overlay.getTitlebarAreaRect() : null;
    const drawn = boxes("nol-window-controls")[0];
    const left = boxes(".nol-status-bar-left > *");
    const right = boxes(".nol-status-bar-right > *");
    return {
      panels: [Math.min(...cards.map(t => t.left)), Math.max(...cards.map(t => t.right))],
      rowStart: first?.getBoundingClientRect().left ?? Number.NaN,
      rowEnd: row.querySelector(".nol-window-row-actions")?.getBoundingClientRect().right ?? Number.NaN,
      controlsStart: area?.right ?? drawn?.left ?? innerWidth,
      statusStart: left[0]?.left ?? Number.NaN,
      statusEnd: right.at(-1)?.right ?? Number.NaN
    } as const;
  });
}

async function fullScreenAsync(mainProcess: MainProcessFixture, isFullScreen: boolean): Promise<void> {
  await mainProcess.application.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0]?.setFullScreen(value), isFullScreen);
  await expect.poll(() => mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isFullScreen()), { timeout: 10_000 }).toBe(isFullScreen);
  await expect.poll(() => mainProcess.window.evaluate(() => document.querySelector("nol-window-row")?.classList.contains("nol-window-row-full-screen"))).toBe(isFullScreen);
}

test.describe("window row and status bar edges", () => {
  test("the outer controls of the window row and the status bar end on the panels' outer borders @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const edges = await edgesAsync(window);
    await mainProcess.checkpointAsync("bar-edges");
    const [left, right] = edges.panels;
    const isMac = process.platform === "darwin";

    expect([edges.statusStart, edges.statusEnd, edges.rowEnd, isMac ? left : edges.rowStart]).toEqual([left, right, isMac ? right : edges.controlsStart, left]);
  });
});

test.describe("window row in macOS full screen", () => {
  test.skip(process.platform !== "darwin", "Only macOS keeps space for its window controls at the start of the row.");

  test("starts at the panels' left border in full screen, and after the traffic lights again once it leaves @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const opened = await edgesAsync(window);

    await fullScreenAsync(mainProcess, true);
    const full = await edgesAsync(window);
    await fullScreenAsync(mainProcess, false);
    const left = await edgesAsync(window);
    await mainProcess.checkpointAsync("bar-edges-full-screen");

    expect([full.rowStart, full.rowEnd, full.statusStart, full.statusEnd]).toEqual([full.panels[0], full.panels[1], full.panels[0], full.panels[1]]);
    expect([opened.rowStart > opened.panels[0] + 60, left.rowStart]).toEqual([true, opened.rowStart]);
  });
});
