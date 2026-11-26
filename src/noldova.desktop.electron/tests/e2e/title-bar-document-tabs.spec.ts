/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

interface ITabsGeometry {
  readonly rem: number;
  readonly tabKeys: readonly string[];
  readonly groupTabs: number;
  readonly tabRegions: readonly string[];
  readonly controlRegions: readonly string[];
  readonly gapRegions: readonly string[];
  readonly rowTop: number;
  readonly rowBottom: number;
  readonly stripTop: number;
  readonly stripBottom: number;
  readonly startEnd: number;
  readonly stripStart: number;
  readonly stripEnd: number;
  readonly fieldStart: number;
  readonly fieldWidth: number;
  readonly contentStart: number;
  readonly contentEnd: number;
  readonly controlsStart: number;
}

const TRAFFIC_LIGHTS = 78;
const SMALL_SCREEN_WINDOW = { width: 921, height: 648 };

async function readAsync(window: Page): Promise<ITabsGeometry> {
  await expect(window.locator("nol-window-row .nol-window-row-tabs nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeAttached();
  await expect(window.locator("nol-window-row .nol-window-row-tabs nol-tab.nol-tab-selected")).toBeVisible();
  await expect(window.locator("nol-window-row .nol-window-row-search")).toBeVisible();
  return window.evaluate(() => {
    const row = document.querySelector<HTMLElement>("nol-window-row");
    if (row === null)
      throw new Error("Nothing matches nol-window-row.");
    const one = (selector: string): DOMRect => {
      const element = row.querySelector(selector);
      if (element === null)
        throw new Error(`Nothing matches ${selector} in the window row.`);
      return element.getBoundingClientRect();
    };
    const regionAt = (x: number, y: number): string => {
      let element = document.elementFromPoint(x, y);
      while (element !== null && ["", "none"].includes(getComputedStyle(element).getPropertyValue("app-region")))
        element = element.parentElement;
      return element === null ? "none" : getComputedStyle(element).getPropertyValue("app-region");
    };
    const centre = (box: DOMRect): string => regionAt(box.left + box.width / 2, box.top + box.height / 2);
    const shown = (elements: Iterable<Element>): DOMRect[] => [...elements].map(t => t.getBoundingClientRect()).filter(t => t.width > 0 && t.height > 0);
    const visible = <T extends Element>(elements: Iterable<T>): T[] => [...elements].filter(t => t.checkVisibility({ visibilityProperty: true }));
    const box = row.getBoundingClientRect();
    const middle = box.top + box.height / 2;
    const tabs = [...row.querySelectorAll<HTMLElement>(".nol-window-row-tabs nol-tab")];
    const strip = one(".nol-window-row-tabs .nol-tab-group-tabs");
    const field = one(".nol-window-row-search");
    const start = one(".nol-window-row-start");
    const shownTabs = visible(tabs);
    const lastTab = shownTabs.at(-1)?.getBoundingClientRect() ?? strip;
    const actions = row.querySelector(".nol-window-row-tabs .nol-tab-group-actions")?.getBoundingClientRect() ?? strip;
    const controls = shown(visible(row.querySelectorAll("button:not(.nol-window-controls-button), nol-tab")));
    const content = shown(row.children);
    const overlay = navigator.windowControlsOverlay;
    const area = overlay?.visible === true ? overlay.getTitlebarAreaRect() : null;
    const drawn = shown(row.querySelectorAll("nol-window-controls"))[0];
    const ownContent = content.filter(t => drawn === undefined || t.left < drawn.left);
    return {
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
      tabKeys: tabs.map(t => String(t.getAttribute("data-tab-key"))),
      groupTabs: document.querySelectorAll("nol-workspace nol-tab[data-tab-key=\"document/notes.note/1\"]").length,
      tabRegions: shownTabs.map(t => centre(t.getBoundingClientRect())),
      controlRegions: controls.map(t => centre(t)),
      gapRegions: [
        regionAt((Math.max(strip.right, actions.right) + field.left) / 2, middle),
        ...(actions.left - lastTab.right > 2 ? [regionAt((lastTab.right + actions.left) / 2, middle)] : []),
        regionAt(box.left + 1, box.top + 1),
        regionAt(field.right + 1, box.top + 1)
      ],
      rowTop: box.top,
      rowBottom: box.bottom,
      stripTop: strip.top,
      stripBottom: strip.bottom,
      startEnd: start.right,
      stripStart: strip.left,
      stripEnd: Math.max(strip.right, actions.right),
      fieldStart: field.left,
      fieldWidth: field.width,
      contentStart: Math.min(...ownContent.map(t => t.left)),
      contentEnd: Math.max(...ownContent.map(t => t.right)),
      controlsStart: area?.right ?? drawn?.left ?? innerWidth
    };
  });
}

function checkPlaces(geometry: ITabsGeometry): void {
  const near = (actual: number, expected: number): void => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);

  expect(geometry.tabKeys).toContain("document/notes.note/1");
  expect(geometry.groupTabs).toBe(0);
  near(geometry.stripTop, geometry.rowTop);
  near(geometry.stripBottom, geometry.rowBottom);
  expect(geometry.stripStart).toBeGreaterThanOrEqual(geometry.startEnd - 0.5);
  expect(geometry.fieldStart - geometry.stripEnd).toBeGreaterThanOrEqual(6 * geometry.rem - 0.5);
  expect(geometry.fieldWidth).toBeGreaterThanOrEqual(12 * geometry.rem - 0.5);
  expect(geometry.contentEnd).toBeLessThanOrEqual(geometry.controlsStart + 0.5);
  if (process.platform === "darwin")
    expect(geometry.contentStart).toBeGreaterThanOrEqual(TRAFFIC_LIGHTS - 0.5);
}

function checkRegions(geometry: ITabsGeometry): void {
  expect(geometry.tabRegions.length).toBeGreaterThan(0);
  expect(geometry.tabRegions).toEqual(Array<string>(geometry.tabRegions.length).fill("no-drag"));
  expect(geometry.controlRegions).toEqual(Array<string>(geometry.controlRegions.length).fill("no-drag"));
  expect(geometry.gapRegions).toEqual(Array<string>(geometry.gapRegions.length).fill("drag"));
}

async function reopenAsync(mainProcess: MainProcessFixture, size: { width: number; height: number }): Promise<void> {
  await test.step(`reopen the window at ${size.width} × ${size.height}, the size a 1024 × 768 screen opens it at`, async () => {
    await mainProcess.application.evaluate(({ BrowserWindow, screen }, bounds) => {
      const area = screen.getPrimaryDisplay().workArea;
      BrowserWindow.getAllWindows()[0]?.setBounds({ x: area.x, y: area.y, ...bounds });
    }, size);
    await expect.poll(() => mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBounds())
      .then(t => [t?.width, t?.height])).toEqual([size.width, size.height]);
    await mainProcess.restartAsync();
  });
}

test.describe("the document tabs in the window row", () => {
  test.use({ mainProcessVariant: BuildVariantFixture.documentTabs });

  test("puts the top-start group's tabs after the row's buttons and the search field after them, and the system's window controls keep their place @smoke", async ({ mainProcess }) => {
    checkPlaces(await readAsync(mainProcess.window));
    for (const mode of WindowModeFixture.modes) {
      await WindowModeFixture.setAsync(mainProcess.window, mode);
      await mainProcess.checkpointAsync(`title-bar-document-tabs-${mode.toLowerCase()}`);
    }
  });

  test("leaves the row a drag region at its ends and between the tabs and the search field, and takes only the tabs and buttons out of it", async ({ mainProcess }) => {
    checkRegions(await readAsync(mainProcess.window));
  });

  test("keeps 6rem before a 12rem search field and the regions in a window a small screen opens, folding the menu bar and the tabs that don't fit", async ({ mainProcess }) => {
    await reopenAsync(mainProcess, SMALL_SCREEN_WINDOW);
    const geometry = await readAsync(mainProcess.window);

    checkPlaces(geometry);
    checkRegions(geometry);
    await mainProcess.checkpointAsync("title-bar-document-tabs-small-screen");
  });
});
