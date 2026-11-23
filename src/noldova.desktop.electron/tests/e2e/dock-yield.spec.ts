/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { Locator, Page } from "@playwright/test";

import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { TabDragFixture } from "./fixtures/tab-drag.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

const notes = "view/notes.list";
const clock = "view/clock.face";
const collapsed = /nol-dock-collapsed/;

function dock(window: Page, side: "Left" | "Right"): Locator {
  return window.locator(`nol-dock[data-side=${side}]`);
}

function middle(window: Page): Locator {
  return window.locator("nol-tab-group[data-group='0']");
}

async function widthAsync(locator: Locator): Promise<number> {
  return (await locator.boundingBox())?.width ?? 0;
}

async function remAsync(window: Page): Promise<number> {
  return await window.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
}

async function workspaceRemAsync(window: Page): Promise<number> {
  return await window.evaluate(() => (document.querySelector("nol-workspace")?.getBoundingClientRect().width ?? 0) / parseFloat(getComputedStyle(document.documentElement).fontSize));
}

async function expectWidthAsync(locator: Locator, width: number): Promise<void> {
  await expect.poll(async () => Math.abs(await widthAsync(locator) - width)).toBeLessThan(1);
}

async function expectNoSidewaysScrollAsync(window: Page): Promise<void> {
  expect(await window.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await window.evaluate(() => [...document.querySelectorAll("nol-workspace")].every(t => t.scrollWidth <= t.clientWidth))).toBe(true);
}

async function dragSashAsync(window: Page, side: "left" | "right", distance: number): Promise<void> {
  const grip = await TabDragFixture.centerOfAsync(window.getByRole("separator", { name: `Resize the ${side} dock` }));
  await window.mouse.move(grip.x, grip.y);
  await window.mouse.down();
  await window.mouse.move(grip.x + distance, grip.y, { steps: 8 });
  await window.mouse.up();
}

async function captureAsync(mainProcess: MainProcessFixture, mode: "light" | "dark"): Promise<void> {
  const window = mainProcess.window;
  const rem = await remAsync(window);
  await mainProcess.useViewportAsync(1920, 1080);
  await expect(dock(window, "Right")).not.toHaveClass(collapsed);
  await mainProcess.checkpointAsync(`docks-default-${mode}`);
  await mainProcess.useViewportAsync(1000, 600);
  await expectWidthAsync(TabDragFixture.groupOf(window, clock), 10 * rem);
  await mainProcess.checkpointAsync(`docks-1000x600-${mode}`);
  await mainProcess.useViewportAsync(640, 480);
  await expect(dock(window, "Left")).toHaveClass(collapsed);
  await mainProcess.checkpointAsync(`docks-minimum-${mode}`);
}

test.describe("docks giving way", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(TabDragFixture.tab(mainProcess.window, notes)).toBeVisible();
  });

  test("the side docks shrink to their minimums and then collapse, right first, before the document narrows, and reopen past a margin as the window widens", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const rem = await remAsync(window);
    const offset = await window.evaluate(() => innerWidth - (document.querySelector("nol-workspace")?.getBoundingClientRect().width ?? 0));
    const at = (width: number): number => Math.round(width * rem + offset);

    await mainProcess.useViewportAsync(1000, 600);
    await expectWidthAsync(TabDragFixture.groupOf(window, clock), 10 * rem);
    await expectWidthAsync(TabDragFixture.groupOf(window, notes), (await workspaceRemAsync(window) - 41) * rem);
    await expectWidthAsync(middle(window), 30 * rem);

    await mainProcess.useViewportAsync(at(50), 600);
    await expect(dock(window, "Right")).toHaveClass(collapsed);
    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await expectWidthAsync(middle(window), 30 * rem);

    await mainProcess.useViewportAsync(640, 480);
    await expect(dock(window, "Left")).toHaveClass(collapsed);
    expect(await widthAsync(middle(window))).toBeGreaterThanOrEqual(30 * rem - 1);
    await expectNoSidewaysScrollAsync(window);

    await mainProcess.useViewportAsync(at(52), 600);
    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await expect(dock(window, "Right")).toHaveClass(collapsed);
    await mainProcess.useViewportAsync(at(53.5), 600);
    await expect(dock(window, "Right")).not.toHaveClass(collapsed);
    await mainProcess.useViewportAsync(1000, 600);
    const left = (await workspaceRemAsync(window) - 41) * rem;
    await expectWidthAsync(TabDragFixture.groupOf(window, notes), left);
    await expectNoSidewaysScrollAsync(window);

    await dragSashAsync(window, "right", -rem);
    await expectWidthAsync(TabDragFixture.groupOf(window, clock), 11 * rem);
    await expectWidthAsync(middle(window), 29 * rem);
    await expectWidthAsync(TabDragFixture.groupOf(window, notes), left);
  });

  test("the person's own dock width comes back as the window widens, and a dock the person hid stays hidden", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const left = TabDragFixture.groupOf(window, notes);
    const chosen = 26 * await remAsync(window) + 80;
    await mainProcess.useViewportAsync(1920, 1080);
    await expectWidthAsync(left, chosen - 80);
    await dragSashAsync(window, "left", 80);
    await expectWidthAsync(left, chosen);
    await window.keyboard.press("ControlOrMeta+Alt+KeyB");
    await expect(dock(window, "Right")).toHaveClass(collapsed);

    await mainProcess.useViewportAsync(640, 480);
    await expect(dock(window, "Left")).toHaveClass(collapsed);
    await mainProcess.useViewportAsync(1920, 1080);

    await expectWidthAsync(left, chosen);
    await expect(dock(window, "Right")).toHaveClass(collapsed);
  });

  test("a dock the narrow window closed opens from its strip or its key and stays open while the window resizes, also beside a dock the person hid", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await mainProcess.useViewportAsync(640, 480);
    await expect(dock(window, "Left")).toHaveClass(collapsed);

    await dock(window, "Left").locator(".nol-dock-strip-view").first().click();

    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await expect(dock(window, "Right")).toHaveClass(collapsed);
    await expect(dock(window, "Left").locator("nol-sash")).toBeVisible();
    await expectNoSidewaysScrollAsync(window);

    await window.keyboard.press("ControlOrMeta+Alt+KeyB");
    await expect(dock(window, "Right")).not.toHaveClass(collapsed);
    await expect(dock(window, "Left")).toHaveClass(collapsed);
    await window.keyboard.press("ControlOrMeta+Alt+KeyB");
    await expect(dock(window, "Right")).toHaveClass(collapsed);
    await expect(dock(window, "Left")).toHaveClass(collapsed);

    await dock(window, "Left").locator(".nol-dock-strip-view").first().click();
    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await mainProcess.useViewportAsync(641, 480);
    await mainProcess.useViewportAsync(640, 480);

    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await expect(dock(window, "Left").locator("nol-sash")).toBeVisible();
  });

  test("when a narrower window closes the dock that holds the focus, the focus moves to that dock's strip", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await mainProcess.useViewportAsync(1000, 600);
    await TabDragFixture.tab(window, notes).click();
    await expect(window.locator(`[data-tab-content="${notes}"] :focus`)).toHaveCount(1);

    await mainProcess.useViewportAsync(640, 480);

    await expect(dock(window, "Left")).toHaveClass(collapsed);
    await expect(dock(window, "Left").locator(`.nol-dock-strip-view[data-view="${notes}"]`)).toBeFocused();
  });

  test("a dragged dock stops at the document's own minimum, the docks give way to the middle the drag left, also after a restart, and a drag back past 30rem widens the middle without moving the other dock", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const rem = await remAsync(window);
    await mainProcess.useViewportAsync(1920, 1080);

    await dragSashAsync(window, "left", 1900 - (await TabDragFixture.centerOfAsync(window.getByRole("separator", { name: "Resize the left dock" }))).x);
    await expectWidthAsync(middle(window), 13.75 * rem);
    await dragSashAsync(window, "left", (await widthAsync(middle(window))) - 20 * rem);
    await expectWidthAsync(middle(window), 20 * rem);

    await mainProcess.useViewportAsync(1000, 600);
    await expectWidthAsync(middle(window), 20 * rem);
    await expectWidthAsync(TabDragFixture.groupOf(window, clock), 10 * rem);
    await mainProcess.reopenAsync();
    const reopened = mainProcess.window;
    await mainProcess.useViewportAsync(1000, 600);
    await expectWidthAsync(middle(reopened), 20 * rem);

    await dragSashAsync(reopened, "left", -15 * rem);
    await expectWidthAsync(middle(reopened), 35 * rem);
    await expectWidthAsync(TabDragFixture.groupOf(reopened, clock), 10 * rem);
  });

  test("the docks give way the same way in light and in dark", async ({ mainProcess }) => {
    await captureAsync(mainProcess, "light");
    await WindowModeFixture.setAsync(mainProcess.window, "Dark");
    await captureAsync(mainProcess, "dark");
  });
});

test.describe("docks giving way to a wide document", () => {
  const note = "document/notes.note/1";
  const wide = "document/notes.wide/board";

  test.use({ mainProcessDataFiles: { "modules/notes/wide": String.empty } });

  test.beforeEach(async ({ mainProcess }) => {
    await expect(TabDragFixture.tab(mainProcess.window, wide)).toBeVisible();
  });

  test("a document that declares 60rem gets at least 60rem in a 1440 by 900 window while it is in front, and the docks come back when a document without it is", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const rem = await remAsync(window);
    await mainProcess.useViewportAsync(1440, 900);
    await TabDragFixture.tab(window, note).click();
    const before = [await widthAsync(TabDragFixture.groupOf(window, notes)), await widthAsync(TabDragFixture.groupOf(window, clock)), await widthAsync(middle(window))];
    expect(before[2]).toBeLessThan(60 * rem);

    await TabDragFixture.tab(window, wide).click();

    await expect.poll(async () => await widthAsync(middle(window))).toBeGreaterThanOrEqual(60 * rem - 1);
    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await expect(dock(window, "Right")).not.toHaveClass(collapsed);
    await expectNoSidewaysScrollAsync(window);

    await TabDragFixture.tab(window, note).click();

    await expectWidthAsync(TabDragFixture.groupOf(window, notes), before[0]);
    await expectWidthAsync(TabDragFixture.groupOf(window, clock), before[1]);
    await expectWidthAsync(middle(window), before[2]);
  });

  test("a dock the person opens from its strip stays open while the wide document is in front, and a dock the person hid stays hidden as it comes and goes", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await mainProcess.useViewportAsync(1100, 700);
    await TabDragFixture.tab(window, note).click();
    await expect(dock(window, "Right")).not.toHaveClass(collapsed);
    await window.keyboard.press("ControlOrMeta+Alt+KeyB");
    await expect(dock(window, "Right")).toHaveClass(collapsed);
    await TabDragFixture.tab(window, wide).click();
    await expect(dock(window, "Left")).toHaveClass(collapsed);

    await dock(window, "Left").locator(".nol-dock-strip-view").first().click();
    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await TabDragFixture.tab(window, note).click();
    await TabDragFixture.tab(window, wide).click();

    await expect(dock(window, "Left")).not.toHaveClass(collapsed);
    await expect(dock(window, "Right")).toHaveClass(collapsed);
    await expectNoSidewaysScrollAsync(window);
  });
});

