/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Locator, Page } from "@playwright/test";

import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test.use({ mainProcessDataFiles: { "modules/notes/board": String.empty } });

const windowBand = "nol-toolbar-band:not(nol-view-toolbar-band nol-toolbar-band)";
const viewBand = "nol-view-toolbar-band nol-toolbar-band";

function bandOf(window: Page, host: string): Locator {
  return window.locator(`${host} .nol-toolbar-band`);
}

function arrangementOf(window: Page, host: string): Promise<readonly (readonly (string | undefined)[])[]> {
  return window.locator(`${host} .nol-toolbar-row`).evaluateAll(rows => rows.map(row => [...row.querySelectorAll<HTMLElement>("nol-toolbar")].map(t => t.dataset["toolbar"])));
}

async function toolbarsMenuAsync(window: Page, host: string): Promise<Locator> {
  await bandOf(window, host).click({ button: "right", position: { x: 2, y: 2 } });
  const menu = window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.toolbars\"]");
  await expect(menu).toBeVisible();
  return menu;
}

async function setShownAsync(window: Page, host: string, title: string, isShown: boolean): Promise<void> {
  const menu = await toolbarsMenuAsync(window, host);
  await expect(menu.getByRole("menuitemcheckbox", { name: title })).toHaveAttribute("aria-checked", String(!isShown));
  await menu.getByRole("menuitemcheckbox", { name: title }).click();
  await expect(window.locator(".cdk-overlay-container nol-menu")).toHaveCount(0);
}

async function dragAsync(window: Page, host: string, name: string, to: Locator, x: (box: { x: number; width: number }) => number, y: (box: { y: number; height: number }) => number): Promise<void> {
  await window.mouse.move(600, 600);
  await expect(window.locator(".cdk-overlay-container nol-tooltip")).toHaveCount(0);
  const grip = await window.locator(`${host} nol-toolbar[data-toolbar="${name}"] .nol-toolbar-grip`).boundingBox();
  const target = await to.boundingBox();
  if (Object.isNull(grip) || Object.isNull(target))
    throw new Error(`No grip for ${name} or no target.`);
  await window.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await window.mouse.down();
  await window.mouse.move(grip.x + grip.width / 2 + 12, grip.y + grip.height / 2 + 12, { steps: 3 });
  await window.mouse.move(x(target), y(target), { steps: 8 });
}

async function dropAsync(window: Page): Promise<void> {
  await window.mouse.up();
  await expect(window.locator(".nol-toolbar-drop")).toHaveCount(0);
}

test.describe("view toolbar bands", () => {
  test("a view's toolbars stand in its own band with the window band's look, and stay out of the window's band and its Toolbars menu", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(bandOf(window, viewBand)).toBeVisible();

    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMain", "notes.boardMore"]]);
    await expect.poll(() => arrangementOf(window, windowBand)).toEqual([["notes.main"], ["notes.second"]]);
    const look = await window.evaluate(({ outer, inner }) => {
      const measure = (selector: string): readonly number[] => {
        const row = document.querySelector(`${selector} .nol-toolbar-row`)?.getBoundingClientRect();
        const item = document.querySelector(`${selector} .nol-toolbar-item`)?.getBoundingClientRect();
        const grip = document.querySelector(`${selector} .nol-toolbar-grip`)?.getBoundingClientRect();
        return [row?.height ?? 0, item?.height ?? 0, item?.width ?? 0, grip?.width ?? 0];
      };
      return [measure(outer), measure(inner)];
    }, { outer: windowBand, inner: viewBand });
    expect(look[1]).toEqual(look[0]);

    const menu = await toolbarsMenuAsync(window, windowBand);
    await expect(menu.getByRole("menuitemcheckbox", { name: "Board" })).toHaveCount(0);
    await window.keyboard.press("Escape");
    const own = await toolbarsMenuAsync(window, viewBand);
    await expect(own.getByRole("menuitemcheckbox")).toHaveCount(2);
    await expect(own.getByRole("menuitemcheckbox", { name: "Board" })).toHaveCount(1);
    await expect(own.getByRole("menuitemcheckbox", { name: "More" })).toHaveCount(1);
    await window.keyboard.press("Escape");
  });

  test("a view's toolbar dragged by its grip moves within its band's row and to a new row, and hides and shows from the band's menu, a shown one standing where it was declared", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const row = window.locator(`${viewBand} .nol-toolbar-row`).first();

    await dragAsync(window, viewBand, "notes.boardMore", row, t => t.x + 8, t => t.y + t.height / 2);
    await expect(window.locator(".nol-toolbar-drop")).toHaveCount(1);
    const line = await window.evaluate(selector => {
      const drop = document.querySelector(".nol-toolbar-drop")?.getBoundingClientRect();
      const band = document.querySelector(selector)?.getBoundingClientRect();
      return drop === undefined || band === undefined ? false : drop.top >= band.top && drop.bottom <= band.bottom;
    }, `${viewBand} .nol-toolbar-band`);
    expect(line).toBe(true);
    await dropAsync(window);
    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMore", "notes.boardMain"]]);

    await dragAsync(window, viewBand, "notes.boardMain", row, t => t.x + 20, t => t.y + 2);
    await expect(window.locator(".nol-drop-line-row")).toBeVisible();
    await dropAsync(window);
    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMain"], ["notes.boardMore"]]);
    const rows = await window.locator(`${viewBand} .nol-toolbar-row`).evaluateAll(t => t.map(u => u.getBoundingClientRect().top));
    expect((rows[1] ?? 0) - (rows[0] ?? 0)).toBeGreaterThan(0);

    await setShownAsync(window, viewBand, "More", false);
    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMain"]]);
    await setShownAsync(window, viewBand, "More", true);
    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMain", "notes.boardMore"]]);
    await expect.poll(() => arrangementOf(window, windowBand)).toEqual([["notes.main"], ["notes.second"]]);
  });

  test("a view's band whose toolbars are all hidden shows one again from its tab's menu", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const group = window.locator("nol-tab-group", { has: window.locator("[data-fixture-content='notes-board']") });

    await setShownAsync(window, viewBand, "More", false);
    await setShownAsync(window, viewBand, "Board", false);
    await expect(bandOf(window, viewBand)).toHaveCount(0);
    await group.locator(".nol-tab-group-menu").click();
    const menu = window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.tab\"]");
    await expect(menu.getByRole("menuitemcheckbox")).toHaveCount(2);
    await expect(menu.getByRole("menuitemcheckbox", { name: "Board" })).toHaveAttribute("aria-checked", "false");
    await menu.getByRole("menuitemcheckbox", { name: "Board" }).click();

    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMain"]]);
    await expect.poll(() => arrangementOf(window, windowBand)).toEqual([["notes.main"], ["notes.second"]]);
  });

  test("the window's band and a view's band drag apart, and a toolbar never leaves its band", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await dragAsync(window, windowBand, "notes.second", window.locator(`${windowBand} .nol-toolbar-row`).first(), t => t.x + t.width - 40, t => t.y + t.height / 2);
    await dropAsync(window);
    await expect.poll(() => arrangementOf(window, windowBand)).toEqual([["notes.main", "notes.second"]]);
    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMain", "notes.boardMore"]]);

    await dragAsync(window, viewBand, "notes.boardMain", window.locator(`${windowBand} .nol-toolbar-row`).first(), t => t.x + 20, t => t.y + t.height / 2);
    await expect(window.locator(".nol-toolbar-drop")).toHaveCount(0);
    await dropAsync(window);
    await expect.poll(() => arrangementOf(window, windowBand)).toEqual([["notes.main", "notes.second"]]);
    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMain", "notes.boardMore"]]);

    await dragAsync(window, windowBand, "notes.main", window.locator(`${viewBand} .nol-toolbar-row`).first(), t => t.x + 20, t => t.y + t.height / 2);
    await expect(window.locator(".nol-toolbar-drop")).toHaveCount(0);
    await dropAsync(window);
    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMain", "notes.boardMore"]]);
  });

  test("a view's band keeps its arrangement across a reopen, and Reset the layout returns the declared one", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await setShownAsync(window, viewBand, "Board", false);
    await expect.poll(() => arrangementOf(window, viewBand)).toEqual([["notes.boardMore"]]);

    await mainProcess.reopenAsync();

    await expect.poll(() => arrangementOf(mainProcess.window, viewBand)).toEqual([["notes.boardMore"]]);
    await expect.poll(() => arrangementOf(mainProcess.window, windowBand)).toEqual([["notes.main"], ["notes.second"]]);
    await CommandSearchFixture.searchAsync(mainProcess.window, "Reset the layout");
    await mainProcess.window.keyboard.press("Enter");
    await expect.poll(() => arrangementOf(mainProcess.window, viewBand)).toEqual([["notes.boardMain", "notes.boardMore"]]);
  });
});
