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
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { TabRowFixture } from "./fixtures/tab-row.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

const notes = "view/notes.list";
const outline = "view/notes.outline";

async function setDockStyleAsync(window: Page, name: string, value: string): Promise<void> {
  await PageBridgeFixture.evaluateAsync(window, (t, [setting, style]) => t.request("desktop.setSetting", { name: setting, value: style }), [name, value] as const);
}

function strip(window: Page): Locator {
  return window.locator("nol-dock[data-side=Left] .nol-dock-strip-rail");
}

function icon(window: Page, key: string): Locator {
  return strip(window).locator(`[data-view="${key}"]`);
}

async function dragOverAsync(window: Page, source: Locator, target: Locator, down: number): Promise<void> {
  const from = await source.boundingBox();
  if (Object.isNull(from))
    throw new Error("The dragged element is not visible.");
  await window.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await window.mouse.down();
  await window.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 3 });
  const to = await target.boundingBox();
  if (Object.isNull(to))
    throw new Error("The drop target is not visible.");
  await window.mouse.move(to.x + to.width / 2, to.y + to.height * down, { steps: 6 });
}

async function dragAsync(window: Page, source: Locator, target: Locator, down: number): Promise<void> {
  await dragOverAsync(window, source, target, down);
  await window.mouse.up();
}

test.describe("activity bar", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(mainProcess.window.locator(`nol-tab[data-tab-key="${notes}"]`)).toBeVisible();
  });

  test("a side shown as icons keeps a toolbar of its views on the window's edge that opens and closes them", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const group = window.locator("nol-tab-group[data-side=Left]");

    await setDockStyleAsync(window, "desktop.leftDockStyle", "Icons");
    await expect(strip(window)).toHaveAttribute("role", "toolbar");
    await expect(strip(window)).toHaveAttribute("aria-orientation", "vertical");
    await expect(icon(window, notes)).toHaveAttribute("aria-pressed", "true");
    await expect(icon(window, outline)).toHaveAttribute("aria-pressed", "false");
    const [rail, panel] = [await strip(window).boundingBox(), await group.boundingBox()];
    expect((rail?.x ?? Infinity) + (rail?.width ?? 0)).toBeLessThan(panel?.x ?? 0);
    await mainProcess.checkpointAsync("left-dock-icons");

    await icon(window, notes).click();
    await expect(group).toHaveCount(0);
    await expect(icon(window, notes)).toHaveAttribute("aria-pressed", "false");
    await icon(window, outline).click();
    await expect(group.locator(".nol-tab-group-title")).toHaveText("Outline");
    await expect(icon(window, outline)).toHaveAttribute("aria-pressed", "true");

    await setDockStyleAsync(window, "desktop.leftDockStyle", "Tabs");
    await expect(strip(window)).toHaveCount(0);
    await expect(group.locator("[role=tablist]")).toBeVisible();
  });

  test("a tab drops into the strip between icons, and an icon drags out like its tab", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const clock = "view/clock.face";
    await setDockStyleAsync(window, "desktop.leftDockStyle", "Icons");
    await expect(icon(window, outline)).toBeVisible();

    await dragAsync(window, window.locator(`nol-tab[data-tab-key="${clock}"]`), icon(window, notes), 0.85);
    await expect(icon(window, clock)).toBeVisible();
    expect(await strip(window).locator(".nol-dock-strip-view").evaluateAll(t => t.map(u => u.getAttribute("data-view")))).toEqual([notes, clock, outline]);

    await dragOverAsync(window, icon(window, outline), icon(window, clock), 0.25);
    await expect(icon(window, clock)).toHaveClass(/nol-drop-line-before/);
    const [lineLength, iconWidth] = await icon(window, clock).evaluate(t => [getComputedStyle(t, "::after").width, getComputedStyle(t).width]);
    expect(lineLength).toBe(iconWidth);
    await window.keyboard.press("Escape");
    await window.mouse.up();

    await dragAsync(window, icon(window, outline), window.locator("[data-drop-side=Right]"), 0.5);
    await expect(window.locator(`nol-tab-group[data-side=Right] nol-tab[data-tab-key="${outline}"]`)).toBeVisible();
    await expect(icon(window, outline)).toHaveCount(0);
  });

  test("a view's badge shows after its tab's title, then on its icon, and joins its accessible name", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const clockTab = window.locator("nol-tab[data-tab-key=\"view/clock.face\"]");
    const clockIcon = window.locator("nol-dock[data-side=Right] .nol-dock-strip-view[data-view=\"view/clock.face\"]");
    await expect(clockTab).toHaveAccessibleName("Clock");
    await expect(clockTab.locator("nol-view-badge")).toHaveCount(0);

    await window.locator("[data-fixture-content=notes-list]").click();
    await window.keyboard.press("ControlOrMeta+Alt+KeyT");
    await expect(clockTab.locator("nol-view-badge")).toHaveText("1");
    await expect(clockTab).toHaveAccessibleName("Clock, 1 ticks");
    await setDockStyleAsync(window, "desktop.rightDockStyle", "Icons");

    await expect(clockIcon.locator("nol-view-badge")).toHaveText("1");
    await expect(clockIcon).toHaveAccessibleName("Clock, 1 ticks");
    await mainProcess.checkpointAsync("view-badge");
  });

  test("the strip is one tab stop driven by the arrow keys, and every group shows a header instead of a tab bar", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await setDockStyleAsync(window, "desktop.leftDockStyle", "Icons");
    await setDockStyleAsync(window, "desktop.rightDockStyle", "Icons");
    await expect(icon(window, outline)).toBeVisible();

    await icon(window, outline).focus();
    await window.keyboard.press("ArrowUp");
    await expect(icon(window, notes)).toBeFocused();
    await window.keyboard.press("End");
    await expect(icon(window, outline)).toBeFocused();
    await window.keyboard.press("Enter");
    await expect(icon(window, outline)).toHaveAttribute("aria-pressed", "true");
    await expect(icon(window, outline)).toHaveAttribute("tabindex", "0");
    await expect(icon(window, notes)).toHaveAttribute("tabindex", "-1");

    await expect(window.locator("nol-tab-group[data-side=Right] .nol-tab-group-title")).toHaveText("Clock");
    await expect(window.locator("nol-tab-group[data-side=Right] [role=tablist]")).toHaveCount(0);
    await expect(window.locator("nol-tab-group[data-side=Right] [role=region]")).toHaveAccessibleName("Clock");
    await expect(window.locator("nol-tab-group[data-side=Left] .nol-tab-group-title")).toHaveText("Outline");
    await expect(window.locator("nol-tab-group[data-side=Left] [role=tablist]")).toHaveCount(0);
    await expect(window.locator("nol-tab-group[data-side=Left] nol-tab")).toHaveCount(0);
    await expect(window.locator("nol-tab-group[data-side=Left] [role=region]")).toHaveAccessibleName("Outline");
    await icon(window, notes).click();
    await expect(window.locator("nol-tab-group[data-side=Left] .nol-tab-group-title")).toHaveText("Notes");
    await WindowModeFixture.expectStrongTextAsync(window, window.locator("nol-tab-group[data-side=Left] .nol-tab-group-title"));
    await mainProcess.checkpointAsync("group-header");
  });

  test("a tab row's first tab and last action stand 0.25rem from its card's start and end in both directions, and a header's title starts where a tab's icon starts", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const group = window.locator("nol-tab-group[data-side=Left]");
    const schemes = ["light", "dark"] as const;
    for (const scheme of schemes) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await mainProcess.checkpointAsync(`tab-row-${scheme}`);
    }
    const tabs = await TabRowFixture.insetsOf(group);
    await TabRowFixture.setDirectionAsync(window, "rtl");
    const reversed = await TabRowFixture.insetsOf(group);
    await mainProcess.checkpointAsync("tab-row-rtl");

    await setDockStyleAsync(window, "desktop.leftDockStyle", "Icons");
    await expect(group.locator(".nol-tab-group-title")).toHaveText("Notes");
    for (const scheme of schemes) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await mainProcess.checkpointAsync(`group-header-${scheme}`);
    }
    const header = await TabRowFixture.insetsOf(group);
    await TabRowFixture.setDirectionAsync(window, "rtl");
    const headerReversed = await TabRowFixture.insetsOf(group);
    await TabRowFixture.setDirectionAsync(window, "ltr");

    for (const inset of [tabs.firstTab, tabs.lastAction, reversed.firstTab, reversed.lastAction, header.lastAction, headerReversed.lastAction])
      expect(inset).toBeCloseTo(tabs.rem * 0.25, 0);
    expect(header.content).toBeCloseTo(tabs.content, 0);
    expect(headerReversed.content).toBeCloseTo(reversed.content, 0);
  });

  test("an icon opens its view's tab menu from the keyboard or a right click, so the view can be docked elsewhere from the strip", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const menus = window.locator(".cdk-overlay-container nol-menu");
    await setDockStyleAsync(window, "desktop.leftDockStyle", "Icons");
    await expect(icon(window, outline)).toBeVisible();

    await icon(window, outline).focus();
    await window.keyboard.press("Shift+F10");
    await window.getByRole("menuitem", { name: "Dock", exact: true }).click();
    await window.getByRole("menuitem", { name: "Dock at the bottom" }).click();
    await expect(menus).toHaveCount(0);

    await expect(window.locator("nol-tab-group[data-side=Bottom] nol-tab")).toHaveAttribute("data-tab-key", outline);
    await expect(icon(window, outline)).toHaveCount(0);

    await icon(window, notes).click({ button: "right" });
    await expect(menus.filter({ has: window.getByRole("menuitem", { name: "Dock", exact: true }) })).toBeVisible();
    await mainProcess.checkpointAsync("strip-icon-menu");
    await window.keyboard.press("Escape");
    await expect(menus).toHaveCount(0);
    await expect(icon(window, notes)).toBeFocused();
  });
});
