/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { ContrastFixture } from "./fixtures/contrast.fixture.ts";
import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

const colors = {
  light: { error: "rgb(161, 38, 13)", menu: "rgb(255, 255, 255)", menuBorder: "rgb(206, 206, 206)" },
  dark: { error: "rgb(244, 135, 113)", menu: "rgb(31, 31, 31)", menuBorder: "rgb(69, 69, 69)" }
};
const titles = ["Note 2 couldn't be saved", "Syncing the clock", "The clock started"];

function bell(window: Page): Locator {
  return window.locator("button.nol-notifications-item");
}

function list(window: Page): Locator {
  return window.locator(".nol-notifications-popover");
}

async function tickWithFocusAsync(mainProcess: MainProcessFixture): Promise<void> {
  await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.focus());
  await expect.poll(() => mainProcess.window.evaluate(() => document.hasFocus())).toBe(true);
  await mainProcess.window.locator("[data-fixture-content=notes-list]").click();
  await mainProcess.window.keyboard.press("ControlOrMeta+Alt+KeyT");
}

async function openNotificationsPageAsync(window: Page): Promise<void> {
  await SettingsFixture.openPageAsync(window, "Notifications");
  await expect(window.locator("nol-setting-row[data-setting=\"desktop.mutedModules\"]")).toBeVisible();
}

test.describe("notifications", () => {
  test("the bell counts the modules' notifications and its list shows them newest first, marking them read", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await expect(bell(window).locator(".nol-notifications-count")).toHaveText("3");
    await expect(bell(window)).toHaveAttribute("aria-label", "Notifications, 3 unread");
    await bell(window).click();

    await expect(list(window).locator(".nol-notifications-row-title")).toHaveText(titles);
    await expect(list(window).locator(".nol-notifications-row").first().locator(".nol-notifications-meta")).toContainText("Notes · ");
    await expect(list(window).locator(".nol-notifications-row").nth(1).locator("nol-progress")).toBeVisible();
    await expect(bell(window).locator(".nol-notifications-count")).toHaveCount(0);
    await expect(bell(window)).toHaveAttribute("aria-label", "Notifications");
  });

  test("an action runs its module's command and closes the list", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await bell(window).click();

    await list(window).getByRole("button", { name: "New note" }).click();

    await expect(list(window)).toHaveCount(0);
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/3\"] .nol-tab-label")).toHaveText("Note 3");
  });

  test("Dismiss removes one and Clear all leaves the work still in progress", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(bell(window).locator(".nol-notifications-count")).toHaveText("3");
    await bell(window).click();

    await list(window).locator(".nol-notifications-row").first().getByRole("button", { name: "Dismiss" }).click();
    await expect(list(window).locator(".nol-notifications-row-title")).toHaveText(titles.slice(1));
    await list(window).getByRole("button", { name: "Clear all" }).click();

    await expect(list(window).locator(".nol-notifications-row-title")).toHaveText(["Syncing the clock"]);
    await expect(list(window).getByRole("button", { name: "Clear all" })).toBeDisabled();
  });

  test("Do not disturb silences the bell, lasts across a restart and is the same setting on the Notifications page", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await bell(window).click();

    await list(window).getByRole("checkbox", { name: "Do not disturb" }).click();
    await expect(list(window).getByRole("checkbox", { name: "Do not disturb" })).toBeChecked();
    await expect(bell(window).locator(".nol-notifications-icon")).toHaveText("notifications_off");
    await mainProcess.restartAsync();

    await expect(bell(mainProcess.window).locator(".nol-notifications-icon")).toHaveText("notifications_off");
    await expect(bell(mainProcess.window)).toHaveAttribute("aria-label", /, Do not disturb$/);
    await bell(mainProcess.window).click();
    await expect(list(mainProcess.window).getByRole("checkbox", { name: "Do not disturb" })).toBeChecked();
    await mainProcess.window.keyboard.press("Escape");
    await openNotificationsPageAsync(mainProcess.window);
    const setting = mainProcess.window.locator("nol-setting-row[data-setting=\"desktop.doNotDisturb\"]").getByRole("checkbox");
    await expect(setting).toBeChecked();
    await setting.click();
    await expect(setting).not.toBeChecked();
    await expect(bell(mainProcess.window).locator(".nol-notifications-icon")).toHaveText("notifications");
  });

  test("a module whose notifications are turned off on the Notifications page still adds them to the list, without a toast or a count", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const toasts = window.locator(".nol-toast");
    const modules = window.locator("nol-setting-row[data-setting=\"desktop.mutedModules\"]");
    await expect(bell(window).locator(".nol-notifications-count")).toHaveText("3");
    await openNotificationsPageAsync(window);
    await expect(modules.locator(".nol-checkbox-text")).toHaveText(["Clock notifications", "Notes notifications", "Reminder notifications"]);
    await expect(modules.getByRole("checkbox", { name: "Clock notifications" })).toBeChecked();
    await mainProcess.checkpointAsync("settings-notifications");

    await modules.getByRole("checkbox", { name: "Clock notifications" }).click();
    await expect(modules.getByRole("checkbox", { name: "Clock notifications" })).not.toBeChecked();
    await expect(bell(window).locator(".nol-notifications-count")).toHaveText("1");
    await tickWithFocusAsync(mainProcess);
    await bell(window).click();

    await expect(list(window).locator(".nol-notifications-row-title").first()).toHaveText("The clock ticked");
    await expect(toasts).toHaveCount(0);
    await expect(modules.getByRole("checkbox", { name: "Clock notifications" })).not.toBeChecked();
  });

  test("a notification posted after startup shows a toast that is announced and closes by itself, and Do not disturb holds the next one back", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const toasts = window.locator(".nol-toast");
    await expect(bell(window).locator(".nol-notifications-count")).toHaveText("3");
    await expect(toasts).toHaveCount(0);

    await tickWithFocusAsync(mainProcess);
    await expect(toasts.locator(".nol-toast-title")).toHaveText(["The clock ticked"]);
    await expect(toasts.locator(".nol-toast-text")).toHaveText(["Ticks: 1"]);
    await expect(window.locator(".cdk-live-announcer-element[aria-live=polite]")).toHaveText("The clock ticked. Ticks: 1");
    await expect(toasts).toHaveCount(0, { timeout: 15_000 });
    await bell(window).click();
    await list(window).getByRole("checkbox", { name: "Do not disturb" }).click();
    await expect(list(window).getByRole("checkbox", { name: "Do not disturb" })).toBeChecked();
    await window.keyboard.press("Escape");
    await tickWithFocusAsync(mainProcess);

    await expect(bell(window).locator(".nol-notifications-count")).toHaveText("1");
    await expect(toasts).toHaveCount(0);
  });

  test("a toast follows the component table, never takes focus and closes on Close", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(bell(window).locator(".nol-notifications-count")).toHaveText("3");
    await tickWithFocusAsync(mainProcess);
    const toast = window.locator(".nol-toast");
    await expect(toast).toHaveCount(1);
    await toast.hover();

    const look = await toast.evaluate(t => {
      const style = getComputedStyle(t);
      const statusBar = document.querySelector("nol-status-bar");
      if (statusBar === null)
        throw new Error("Nothing matches nol-status-bar.");
      const bar = statusBar.getBoundingClientRect();
      const box = t.getBoundingClientRect();
      return {
        isDark: matchMedia("(prefers-color-scheme: dark)").matches,
        width: style.width, padding: style.paddingTop, border: style.borderTopWidth, radius: style.borderTopLeftRadius, hasShadow: style.boxShadow !== "none",
        background: style.backgroundColor, borderColor: style.borderTopColor,
        right: Math.round(document.documentElement.clientWidth - box.right), gapAboveBar: Math.round(bar.top - box.bottom),
        hasFocus: t.contains(document.activeElement)
      };
    });
    const palette = look.isDark ? { background: "rgb(31, 31, 31)", border: "rgb(69, 69, 69)" } : { background: "rgb(255, 255, 255)", border: "rgb(229, 229, 229)" };

    expect({ ...look, isDark: undefined }).toEqual({
      isDark: undefined, width: "360px", padding: "12px", border: "1px", radius: "8px", hasShadow: true,
      background: palette.background, borderColor: palette.border, right: 8, gapAboveBar: 8, hasFocus: false
    });
    await mainProcess.checkpointAsync("toast");
    await toast.getByRole("button", { name: "Close" }).click();
    await expect(toast).toHaveCount(0);
  });

  test("the bell and its list follow the component table", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(bell(window).locator(".nol-notifications-count")).toHaveText("3");

    const item = await window.evaluate(() => {
      const style = (selector: string): CSSStyleDeclaration => {
        const element = document.querySelector(selector);
        if (element === null)
          throw new Error(`Nothing matches ${selector}.`);
        return getComputedStyle(element);
      };
      const button = style("button.nol-notifications-item");
      const order = [...document.querySelectorAll(".nol-status-bar-right > *")].map(t => t.tagName.toLowerCase());
      return {
        isDark: matchMedia("(prefers-color-scheme: dark)").matches,
        height: button.height, padding: [button.paddingLeft, button.paddingRight], radius: button.borderTopLeftRadius, iconSize: style(".nol-notifications-icon").fontSize,
        isBeforeFailures: order.indexOf("nol-notifications") === order.indexOf("nol-module-failures") - 1
      };
    });
    await bell(window).click();
    await expect(list(window).locator(".nol-notifications-row")).toHaveCount(3);
    const surface = await list(window).evaluate(t => {
      const style = getComputedStyle(t);
      const errorIcon = t.querySelector(".nol-notifications-row[data-severity=Error] .nol-notifications-severity");
      if (errorIcon === null)
        throw new Error("Nothing matches .nol-notifications-row[data-severity=Error] .nol-notifications-severity.");
      const checkbox = t.querySelector(".nol-notifications-quiet .nol-checkbox-box");
      if (checkbox === null)
        throw new Error("Nothing matches .nol-notifications-quiet .nol-checkbox-box.");
      return {
        width: style.width, padding: style.paddingTop, border: style.borderTopWidth, borderColor: style.borderTopColor, radius: style.borderTopLeftRadius,
        background: style.backgroundColor, hasShadow: style.boxShadow !== "none",
        errorIcon: getComputedStyle(errorIcon).color,
        checkbox: getComputedStyle(checkbox).width
      };
    });
    const [placed, anchor] = await Promise.all([list(window), bell(window)].map(t => t.evaluate(u => (({ x, y, width, height, top, right, bottom, left }) => ({ x, y, width, height, top, right, bottom, left }))(u.getBoundingClientRect()))));
    const palette = item.isDark ? colors.dark : colors.light;

    expect({ ...item, isDark: undefined }).toEqual({ isDark: undefined, height: "20px", padding: ["6px", "6px"], radius: "3px", iconSize: "16px", isBeforeFailures: true });
    expect(surface).toEqual({
      width: "440px", padding: "12px", border: "1px", borderColor: palette.menuBorder, radius: "8px", background: palette.menu, hasShadow: true,
      errorIcon: palette.error, checkbox: "18px"
    });
    expect(Math.round((anchor?.["top"] ?? 0) - (placed?.["bottom"] ?? 0))).toBe(8);
    expect(Math.abs((anchor?.["right"] ?? 0) - (placed?.["right"] ?? 0))).toBeLessThan(1);
    await mainProcess.checkpointAsync("notifications");
  });

  test("the progress bar of a notification in progress is visible in the list and moves, in light and in dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(bell(window).locator(".nol-notifications-count")).toHaveText("3");
    const colorOf = (variable: string): Promise<string> => window.evaluate(name => {
      const probe = document.createElement("div");
      probe.style.backgroundColor = `var(${name})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    }, variable);

    const popoverSurface = { light: "rgb(255, 255, 255)", dark: "rgb(31, 31, 31)" };
    await bell(window).click();
    await expect(list(window).locator(".nol-notifications-row")).toHaveCount(3);
    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await expect(list(window)).toHaveCSS("background-color", popoverSurface[scheme]);
      await mainProcess.checkpointAsync(`progress-in-the-list-${scheme}`);
      const track = list(window).locator(".nol-notifications-row").nth(1).locator("nol-progress");
      const fill = track.locator(".nol-progress-bar");
      await expect(fill).toBeVisible();

      const look = await track.evaluate(t => {
        const bar = t.querySelector(".nol-progress-bar");
        if (bar === null)
          throw new Error("Nothing matches .nol-progress-bar.");
        const popover = t.closest(".nol-notifications-popover");
        if (popover === null)
          throw new Error("Nothing around the track matches .nol-notifications-popover.");
        return {
          track: getComputedStyle(t).backgroundColor, fill: getComputedStyle(bar).backgroundColor, animation: getComputedStyle(bar).animationName,
          surface: getComputedStyle(popover).backgroundColor,
          width: bar.getBoundingClientRect().width, height: bar.getBoundingClientRect().height
        };
      });

      expect(look.fill).toBe(await colorOf("--nol-progress"));
      expect(look.fill).not.toBe(look.surface);
      expect(look.fill.startsWith("rgb(")).toBe(true);
      expect(look.surface.startsWith("rgb(")).toBe(true);
      expect(ContrastFixture.measureContrast(look.fill, look.surface)).toBeGreaterThanOrEqual(3);
      expect(look.fill).not.toBe(look.track);
      expect(look.fill).not.toMatch(/^rgba\(.*, 0\)$/);
      expect(look.width).toBeGreaterThan(0);
      expect(look.height).toBeGreaterThan(0);
      expect(look.animation).toContain("nol-progress-slide");
      const first = (await fill.boundingBox())?.x;
      await expect.poll(async () => (await fill.boundingBox())?.x).not.toBe(first);
    }
    await WindowModeFixture.expectStrongTextAsync(window, window.locator(".nol-notifications-title"), list(window).locator(".nol-notifications-row-title").first());
  });
});
