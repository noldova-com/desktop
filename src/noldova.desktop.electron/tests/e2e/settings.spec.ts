/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { access, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import type { Locator, Page } from "@playwright/test";

import { ContrastFixture } from "./fixtures/contrast.fixture.ts";
import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { NotesOptionsFixture } from "./fixtures/notes-options.fixture.ts";
import { ScrollAreaFixture } from "./fixtures/scroll-area.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";
import { TabContentFixture } from "./fixtures/tab-content.fixture.ts";
import { TabDragFixture } from "./fixtures/tab-drag.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

const settingsKey = "document/desktop.settings";

function settingsTab(window: Page): Locator {
  return TabDragFixture.tab(window, settingsKey);
}

async function expectSamePageAsync(window: Page, top: number): Promise<void> {
  await expect(window.locator(".nol-settings-pages [aria-selected=true]")).toHaveText("Keyboard shortcuts");
  await expect.poll(() => ScrollAreaFixture.scrollTopAsync(window.locator(".nol-settings-content"))).toBe(top);
}

function row(window: Page, name: string): Locator {
  return window.locator(`nol-setting-row[data-setting="${name}"]`);
}

async function otherModeAsync(window: Page): Promise<"Light" | "Dark"> {
  return await window.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches) ? "Light" : "Dark";
}

async function chooseAsync(window: Page, name: string, option: string): Promise<void> {
  await row(window, name).getByRole("radio", { name: option, exact: true }).click();
}

async function rootFontSizeAsync(window: Page): Promise<string> {
  return await window.evaluate(() => getComputedStyle(document.documentElement).fontSize);
}

async function nativeBackgroundAsync(mainProcess: MainProcessFixture): Promise<string> {
  return await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBackgroundColor() ?? "");
}

test.describe("settings", () => {
  test("a module's window part changes its setting, its runtime part uses the new value, and the value outlives reopening the window @smoke", async ({ mainProcess }) => {
    const step = (): Locator => mainProcess.window.locator("[data-fixture-content=clock-step]");
    await expect(step()).toHaveText("Step: 1");

    await mainProcess.window.locator("[data-fixture-content=clock-step-up]").click();
    await expect(step()).toHaveText("Step: 2");
    await mainProcess.window.locator("[data-fixture-content=notes-list]").click();
    await mainProcess.window.keyboard.press("ControlOrMeta+Alt+KeyT");

    await expect(mainProcess.window.locator("[data-fixture-content=clock-ticks]")).toHaveText("Ticks: 2");
    await mainProcess.reopenAsync();
    await expect(step()).toHaveText("Step: 2");
    await mainProcess.checkpointAsync("settings-module-step");
  });

  test("Settings opens by its key as one document, lists its pages, says the runtime is connected, and shows the shell's keys, which Mod+/ opens @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await SettingsFixture.openAsync(window);
    await window.keyboard.press("ControlOrMeta+Comma");

    await expect(settingsTab(window)).toHaveCount(1);
    await expect(settingsTab(window)).toHaveAttribute("aria-selected", "true");
    await expect(window.locator(".nol-settings-pages .nol-tree-label")).toHaveText(["General", "Appearance", "Notifications", "Keyboard shortcuts", "Clock", "Notes", "Gallery", "About"]);
    await expect(window.getByRole("treeitem", { name: "General", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(window.locator(".nol-settings-group-title")).toHaveText(["Runtime", "Date and time"]);
    await expect(window.locator("nol-runtime-status").getByRole("status")).toHaveText("Connected");
    await expect(window.locator("nol-setting-row .nol-setting-row-title")).toHaveText(["Clock", "Time format", "Date and time format"]);
    await window.getByRole("treeitem", { name: "General", exact: true }).focus();
    await window.keyboard.press("ArrowDown");
    await window.keyboard.press("Enter");
    await expect(window.locator(".nol-settings-group-title")).toHaveText(["Theme", "Text", "Layout", "Command search", "Spelling"]);
    await window.keyboard.press("ArrowDown");
    await window.keyboard.press("Enter");
    await expect(window.locator(".nol-settings-group-title")).toHaveText(["Notifications", "Background"]);
    await expect(window.getByRole("treeitem", { name: "Notifications", exact: true })).toHaveAttribute("aria-selected", "true");
    await window.keyboard.press("ControlOrMeta+Slash");
    await expect(window.getByRole("treeitem", { name: "Keyboard shortcuts", exact: true })).toHaveAttribute("aria-selected", "true");
    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      expect(await ContrastFixture.measureLowestTextContrastAsync(window.locator(".nol-settings-pages [role=treeitem][aria-selected=true]"), ContrastFixture.SELECTED_ROW_BACKGROUND[scheme]))
        .toBeGreaterThanOrEqual(ContrastFixture.MINIMUM_TEXT_CONTRAST);
    }
    await expect(window.locator("[data-command=\"desktop.openSettings\"] .nol-shortcut-title")).toHaveText("Settings…");
    await mainProcess.checkpointAsync("settings-shortcuts");
  });

  test("Appearance's Spelling group checks spelling by default and offers the shipped dictionaries, or says that macOS chooses the languages", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openPageAsync(window, "Appearance");
    const group = window.locator(".nol-settings-group").filter({ has: window.locator(".nol-settings-group-title", { hasText: "Spelling" }) });
    const languages = row(window, "desktop.spellCheckLanguages");

    await group.scrollIntoViewIfNeeded();

    await expect(group.getByRole("checkbox", { name: /Underline misspelled words/ })).toBeChecked();
    if (process.platform === "darwin") {
      await expect(languages.locator(".nol-setting-row-note")).toHaveText("On macOS the system chooses the spelling languages.");
      await expect(languages.getByRole("checkbox")).toHaveCount(0);
    } else {
      await expect(languages.getByRole("checkbox", { name: "English (United States)" })).not.toBeChecked();
      const notes = await languages.locator(".nol-setting-row-note").allTextContents();
      expect(notes.filter(t => t !== "None of this device's languages has a dictionary here, so words are checked in English (United States).")).toEqual([]);
      await access(path.join(mainProcess.dataDirectory, "main", "Dictionaries", "en-US-10-1.bdic"));
    }
    await mainProcess.checkpointAsync("settings-spelling");
  });

  test("About shows the logo the build put beside the window for each mode, names the version and the platform, says updates are off in a build that names no feed, and leaves out the setting that checks for them", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openPageAsync(window, "About");
    const about = window.getByRole("region", { name: "About Noldova Desktop Sample" });

    await expect(about.locator(".nol-about-title")).toHaveText(/^Noldova Desktop Sample \d+\.\d+\.\d+/);
    await expect(about.locator(".nol-about-platform")).toHaveText(/^(Windows|macOS|Linux) (x64|ARM64)$/);
    await expect(about.getByRole("status")).toHaveText("Updates are turned off in this build.");
    await expect(about.getByRole("button")).toHaveCount(0);
    await expect(window.locator(".nol-settings-group-title")).toHaveCount(0);
    await expect(window.locator(".nol-update-item")).toHaveCount(0);
    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await expect(about.locator(".nol-about-logo")).toHaveAttribute("src", `about/icon-${scheme}-512.png`);
      await expect.poll(() => about.locator(".nol-about-logo").evaluate(t => t instanceof HTMLImageElement ? t.naturalWidth : 0)).toBeGreaterThan(0);
      await mainProcess.checkpointAsync(`settings-about-${scheme}`);
    }
  });

  test("a module's action setting opens the module's own document from its row once per press, by pointer or Enter, and stores nothing", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const note = (id: number): Locator => window.locator(`nol-tab[data-tab-key="document/notes.note/${id}"]`);
    const count = window.locator("nol-status-bar-item[data-nol-item=\"notes.count\"]");
    const start = row(window, "notes.start").getByRole("button", { name: "Start a note" });
    await expect(count).toHaveText("2 notes");
    await SettingsFixture.openPageAsync(window, "Notes");

    await expect(window.locator(".nol-settings-group-title")).toHaveText(["Writing"]);
    await expect(row(window, "notes.start").locator(".nol-setting-row-description")).toHaveText("Opens a new note in a tab of its own.");
    await expect(start).toBeEnabled();
    await mainProcess.checkpointAsync("settings-action");
    await start.click();

    await expect(note(3)).toHaveAttribute("aria-selected", "true");
    await expect(count).toHaveText("3 notes");
    await settingsTab(window).click();
    await expect(window.getByRole("treeitem", { name: "Notes", exact: true })).toHaveAttribute("aria-selected", "true");
    await start.focus();
    await window.keyboard.press("Enter");

    await expect(note(4)).toHaveAttribute("aria-selected", "true");
    await expect(count).toHaveText("4 notes");
    await settingsTab(window).click();
    await expect(row(window, "notes.start").locator(".nol-setting-row-marker, .nol-setting-row-reset")).toHaveCount(0);
    await expect(window.locator("nol-tab[data-tab-key^=\"document/notes.note/\"]")).toHaveCount(4);
  });

  test("a module's window part reads its setting for one of its objects through the object's folder and the application, and sets and resets it there", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const note = (id: number): Locator => window.locator(`nol-tab[data-tab-key="document/notes.note/${id}"]`);
    const wrapping = (id: number): Locator => window.locator(`[data-fixture-content=notes-wrapping-${id}]`);
    const press = async (action: string, id: number): Promise<void> => await window.locator(`[data-fixture-content=notes-${action}-${id}]`).click();
    await note(1).click();
    await expect(wrapping(1)).toHaveText("Wraps lines: no, not set for this note");

    await press("wrap-note", 1);
    await expect(wrapping(1)).toHaveText("Wraps lines: yes, set for this note");
    await press("wrap-inbox", 1);
    await press("reset-note", 1);
    await expect(wrapping(1)).toHaveText("Wraps lines: yes, not set for this note");
    await note(2).click();
    await expect(wrapping(2)).toHaveText("Wraps lines: yes, not set for this note");
    await press("reset-inbox", 2);
    await expect(wrapping(2)).toHaveText("Wraps lines: no, not set for this note");
    await SettingsFixture.openPageAsync(window, "Notes");
    const setting = row(window, "notes.wrapsLines");
    await expect(setting.getByRole("checkbox")).not.toBeChecked();
    await expect(setting.locator(".nol-setting-row-marker")).toHaveCount(0);
    await setting.getByRole("checkbox").click();
    await note(1).click();

    await expect(wrapping(1)).toHaveText("Wraps lines: yes, not set for this note");
    await mainProcess.checkpointAsync("settings-scoped-read");
    await mainProcess.restartAsync();
    const reopened = await TabContentFixture.openAsync(mainProcess.window, "document/notes.note/1");
    await expect(reopened.locator("[data-fixture-content=notes-wrapping-1]")).toHaveText("Wraps lines: yes, not set for this note");
  });

  test("the page list reveals its scrollbar's thumb colour while hovered, a long page shows its thumb while hovered, and dragging that thumb scrolls the page", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const content = window.locator(".nol-settings-content");
    await SettingsFixture.openGalleryAsync(window);
    await expect(content.locator("nol-quick-input").getByRole("option").first()).toBeAttached();
    expect(await content.evaluate(t => t.scrollHeight > t.clientHeight)).toBe(true);

    await ScrollAreaFixture.revealThumbColorAsync(window, window.locator(".nol-settings-pages"));
    expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, content, "vertical")).toBe(true);
    const drag = await ScrollAreaFixture.dragVerticalThumbAsync(window, content, 100);

    await expect.poll(async () => Math.abs(await ScrollAreaFixture.scrollTopAsync(content) - drag.start - drag.distance)).toBeLessThan(drag.distance / 10);
  });

  test("a page scrolled with the keyboard while the pointer rests elsewhere shows its thumb, then hides it about a second after the last scroll event", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const content = window.locator(".nol-settings-content");
    await SettingsFixture.openPageAsync(window, "Keyboard shortcuts");
    await content.locator(".nol-settings-group-title").first().click();
    await ScrollAreaFixture.restPointerAsync(window, content);
    const hidden = await ScrollAreaFixture.scrollbarImageAsync(window, content, "vertical");
    await ScrollAreaFixture.holdRevealAsync(content);

    await window.keyboard.press("PageDown");
    await ScrollAreaFixture.expectThumbShownAsync(content, true);
    const shown = await ScrollAreaFixture.scrollbarImageAsync(window, content, "vertical");
    await mainProcess.checkpointAsync("settings-keyboard-scroll-thumb");
    expect(shown).not.toEqual(hidden);
    expect(await ScrollAreaFixture.scrollTopAsync(content)).toBeGreaterThan(0);
    const released = Date.now();
    await ScrollAreaFixture.releaseRevealAsync(content);
    await ScrollAreaFixture.expectThumbShownAsync(content, false);

    expect(Date.now() - released, "a timing lower bound: the thumb stays shown for its 1 s linger after the reveal is released; a busy machine only lengthens it").toBeGreaterThanOrEqual(1000);
    expect(await content.evaluate(t => t.matches(":hover"))).toBe(false);
  });

  test("on a wide panel Settings scrolls from its page list to the panel's edge, fills it with its column and scrolls by the wheel at the column's end", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const content = window.locator(".nol-settings-content");
    await mainProcess.useViewportAsync(2400, 1000);
    await SettingsFixture.openGalleryAsync(window);
    await expect(content.locator("nol-quick-input").getByRole("option").first()).toBeAttached();
    const [settings, scroller, column] = await Promise.all(["nol-settings", ".nol-settings-content", ".nol-settings-column"].map(t => window.locator(t).boundingBox()));
    const end = (box: typeof settings): number => (box?.x ?? 0) + (box?.width ?? 0);
    const reach = await content.evaluate(t => t.getBoundingClientRect().left + t.clientWidth);

    expect(Math.abs(end(scroller) - end(settings))).toBeLessThan(1);
    expect(await content.evaluate(t => getComputedStyle(t).scrollbarGutter)).toBe("stable");
    expect(Math.abs(end(column) - reach)).toBeLessThan(1);
    await window.mouse.move(end(column) - 10, (column?.y ?? 0) + 200);
    await window.mouse.wheel(0, 300);
    await expect.poll(() => ScrollAreaFixture.scrollTopAsync(content)).toBeGreaterThan(0);
    await ScrollAreaFixture.revealThumbColorAsync(window, content);
    await mainProcess.checkpointAsync("settings-wide-light");
    await WindowModeFixture.setAsync(window, "Dark");
    await ScrollAreaFixture.revealThumbColorAsync(window, content);
    await mainProcess.checkpointAsync("settings-wide-dark");
  });

  test("Settings has one scroller whose scrollbar ends at the panel's edge in its wide and narrow layouts, in light and dark, as a document's and a docked view's do", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const content = window.locator(".nol-settings-content");
    const outer = window.locator("nol-tab-content:has(nol-settings)");
    const expectAtEdgeAsync = async (area: Locator, where: string): Promise<void> => {
      await expect.poll(async () => Math.abs(await ScrollAreaFixture.panelEdgeGapAsync(area)), { message: `${where}: the scroll area's end to the panel's inner edge` }).toBeLessThan(1);
      await expect.poll(async () => {
        const sizes = await ScrollAreaFixture.scrollbarSizesAsync(area);
        return Math.abs(sizes.vertical - 0.375 * sizes.rem);
      }, { message: `${where}: the scrollbar's width to 0.375rem` }).toBeLessThan(0.5);
    };
    for (const [key, page] of [["view/notes.list", "nol-notes-list"], ["document/notes.note/1", "nol-notes-note"]] as const) {
      const area = await TabContentFixture.openAsync(window, key);
      await expect(window.locator(`nol-tab[data-tab-key='${key}']`)).toHaveAttribute("aria-selected", "true");
      await expect(area.locator(page)).toBeVisible();
      await expectAtEdgeAsync(area, key);
    }
    await SettingsFixture.openPageAsync(window, "Keyboard shortcuts");

    for (const [layout, width, height] of [["wide", 1600, 900], ["narrow", 1000, 600]] as const) {
      await mainProcess.useViewportAsync(width, height);
      await expect(window.locator(layout === "wide" ? ".nol-settings-pages" : ".nol-settings-page-select")).toBeVisible();
      for (const mode of WindowModeFixture.modes) {
        const where = `Settings, ${layout} layout, ${mode}`;
        await WindowModeFixture.setAsync(window, mode);
        await expectAtEdgeAsync(content, where);
        expect((await ScrollAreaFixture.scrollbarSizesAsync(outer)).vertical, `${where}: the tab content's own scrollbar`).toBe(0);
        expect(await outer.evaluate(t => getComputedStyle(t).scrollbarGutter), `${where}: the tab content's gutter`).toBe("auto");
        await ScrollAreaFixture.revealThumbColorAsync(window, content);
        await mainProcess.checkpointAsync(`settings-edge-${layout}-${mode.toLowerCase()}`);
      }
    }
  });

  test("Settings stands a hovered row the tabs' gap above the next one, in Light and Dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openPageAsync(window, "Appearance");
    const row = window.locator(".nol-settings-rows").first().locator("nol-setting-row").first();
    for (const mode of ["Light", "Dark"] as const) {
      await WindowModeFixture.setAsync(window, mode);
      await row.hover();
      const look = await row.evaluate(t => {
        const next = t.nextElementSibling;
        if (next === null)
          throw new Error("The setting row has no row after it.");
        return [next.tagName, (next.getBoundingClientRect().top - t.getBoundingClientRect().bottom) / Number.parseFloat(getComputedStyle(document.documentElement).fontSize)];
      });
      expect(look[0]).toBe("NOL-SETTING-ROW");
      expect(look[1]).toBeCloseTo(0.25, 1);
      await mainProcess.checkpointAsync(`settings-row-gap-${mode.toLowerCase()}`);
    }
  });

  test("in a 1000 × 600 window Settings swaps its page list for a select, and its content takes the width, its controls work and its scrollbar drags", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const content = window.locator(".nol-settings-content");
    const pages = window.locator(".nol-settings-page-select").getByRole("button");
    await SettingsFixture.openPageAsync(window, "Appearance");
    await expect(window.locator(".nol-settings-pages")).toBeVisible();
    await mainProcess.checkpointAsync("settings-default-light");

    await mainProcess.useViewportAsync(1000, 600);

    await expect(window.locator(".nol-settings-pages")).toBeHidden();
    await expect(pages).toHaveAccessibleName("Settings pages, Appearance");
    const [body, filled] = await Promise.all([window.locator(".nol-settings-body").boundingBox(), content.boundingBox()]);
    expect(Math.abs((filled?.width ?? 0) - (body?.width ?? -1))).toBeLessThan(1);
    await ScrollAreaFixture.revealThumbColorAsync(window, content);
    await mainProcess.checkpointAsync("settings-narrow-light");
    await WindowModeFixture.setAsync(window, "Dark");
    await ScrollAreaFixture.revealThumbColorAsync(window, content);
    await mainProcess.checkpointAsync("settings-narrow-dark");
    await chooseAsync(window, "desktop.mode", "Light");
    await expect(row(window, "desktop.mode").getByRole("radio", { name: "Light", exact: true })).toBeChecked();
    await SettingsFixture.choosePageAsync(window, "Gallery");
    await expect(content.locator("nol-quick-input").getByRole("option").first()).toBeAttached();
    const drag = await ScrollAreaFixture.dragVerticalThumbAsync(window, content, 100);
    await expect.poll(async () => Math.abs(await ScrollAreaFixture.scrollTopAsync(content) - drag.start - drag.distance)).toBeLessThan(drag.distance / 10);
  });

  test("search filters every page by title, description and name, marking the matches, and choosing a page ends it", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openAsync(window);

    await window.getByRole("searchbox", { name: "Search settings" }).fill("size");

    await expect(window.locator(".nol-settings-result-title")).toHaveText(["Appearance"]);
    await expect(window.locator("nol-setting-row .nol-setting-row-title")).toHaveText(["Interface text size", "Message text size", "Code text size"]);
    await expect(window.locator("nol-setting-row mark").first()).toHaveText("size");
    await mainProcess.checkpointAsync("settings-search");
    await window.getByRole("searchbox", { name: "Search settings" }).fill("clock.tickStep");
    await expect(window.locator(".nol-settings-result-title")).toHaveText(["Clock"]);
    await window.getByRole("treeitem", { name: "Notifications", exact: true }).click();
    await expect(window.getByRole("searchbox", { name: "Search settings" })).toHaveValue(String.empty);
    await expect(window.locator(".nol-settings-group-title")).toHaveText(["Notifications", "Background"]);
  });

  test("a person who never set the code text size sees 12 in Appearance, and code is drawn at 12px", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openPageAsync(window, "Appearance");

    await expect(row(window, "desktop.codeSize").locator("input")).toHaveValue("12");
    await expect(row(window, "desktop.messageSize").locator("input")).toHaveValue("13");
    await expect.poll(() => window.evaluate(() => ["--nol-text-code", "--nol-text-message"].map(t => getComputedStyle(document.documentElement).getPropertyValue(t)))).toEqual(["12px", "13px"]);
  });

  test("Keyboard shortcuts shows each command's id under its title, and a search by a part found only in an id finds the row and underlines that part", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const split = window.locator("[data-command=\"desktop.splitTabUp\"]");
    await SettingsFixture.openPageAsync(window, "Keyboard shortcuts");

    await expect(split.locator(".nol-shortcut-name")).toHaveText("desktop.splitTabUp");
    await window.locator(".nol-settings-content").hover({ position: { x: 4, y: 4 } });
    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await mainProcess.checkpointAsync(`settings-shortcut-ids-${scheme}`);
    }
    await window.getByRole("searchbox", { name: "Search settings" }).fill("bu");

    await expect(split.locator(".nol-shortcut-title")).toHaveText("Split the tab up");
    await expect(split.locator(".nol-shortcut-name mark")).toHaveText(["bU"]);
    await expect(split.locator(".nol-shortcut-title mark, .nol-shortcut-owner mark, .nol-shortcut-key mark")).toHaveCount(0);
    await expect(window.locator(".nol-settings-pages [aria-selected=true]")).toHaveCount(0);
    expect(await split.locator(".nol-shortcut-name mark").evaluate(t => getComputedStyle(t).textDecorationLine)).toBe("underline");
    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await mainProcess.checkpointAsync(`settings-shortcut-id-search-${scheme}`);
    }
  });

  test("in the narrowest window every command's id stays within its Command cell, which keeps a text field's width, and the Settings content scrolls sideways to its row actions under a scrollbar at its bottom edge, shown at the top of the page", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const longest = window.locator("[data-command=\"desktop.moveTabToPreviousGroup\"]");
    const scroll = window.locator("nol-settings .nol-settings-content");
    await SettingsFixture.openPageAsync(window, "Keyboard shortcuts");

    await mainProcess.useViewportAsync(640, 480);
    await window.locator(".nol-settings-content").hover({ position: { x: 4, y: 4 } });
    const overflows = await window.locator("nol-shortcuts tbody tr").evaluateAll(rows => rows.map(t => {
      const cell = t.querySelector<HTMLElement>("td");
      if (cell === null)
        throw new Error("Nothing matches td.");
      const end = cell.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(cell).paddingRight);
      const name = t.querySelector<HTMLElement>(".nol-shortcut-name");
      if (name === null)
        throw new Error("Nothing matches .nol-shortcut-name.");
      return [t.getAttribute("data-command"), Math.max(0, Math.round(name.getBoundingClientRect().right - end))] as const;
    }));
    const fieldWidth = await window.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.width = "var(--nol-text-field-width)";
      document.body.append(probe);
      const width = probe.getBoundingClientRect().width;
      probe.remove();
      return width;
    });

    expect(overflows.length).toBeGreaterThan(20);
    expect(overflows.filter(t => t[1] !== 0)).toEqual([]);
    expect(await longest.locator("td").first().evaluate(t => t.getBoundingClientRect().width)).toBeGreaterThanOrEqual(fieldWidth - 0.5);
    expect(await scroll.evaluate(t => t.scrollWidth - t.clientWidth)).toBeGreaterThan(0);
    const bottoms = await window.evaluate(() => [".nol-settings-content", "nol-settings"].map(t => {
      const element = document.querySelector<HTMLElement>(t);
      if (element === null)
        throw new Error(`Nothing matches ${t}.`);
      return Math.round(element.getBoundingClientRect().bottom);
    }));
    expect([await ScrollAreaFixture.scrollTopAsync(scroll), (await ScrollAreaFixture.scrollbarSizesAsync(scroll)).horizontal > 0, bottoms[0] === bottoms[1]]).toEqual([0, true, true]);
    expect(await ScrollAreaFixture.thumbChangesOnHoverAsync(window, scroll, "horizontal")).toBe(true);
    await longest.scrollIntoViewIfNeeded();
    await scroll.evaluate(t => {
      t.scrollLeft = 0;
    });
    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await mainProcess.checkpointAsync(`settings-shortcut-ids-narrow-${scheme}`);
    }

    const close = window.locator("[data-command=\"desktop.closeTab\"]").getByRole("button", { name: /^Remove/ });
    await close.scrollIntoViewIfNeeded();
    await expect(close).toBeInViewport();
    expect(await scroll.evaluate(t => t.scrollLeft)).toBeGreaterThan(0);
    await window.getByRole("searchbox", { name: "Search settings" }).fill("Group");
    const next = window.locator("[data-command=\"desktop.moveTabToNextGroup\"] .nol-shortcut-name");
    await expect(next.locator("mark")).toHaveText(["Group"]);
    await next.scrollIntoViewIfNeeded();
    await mainProcess.checkpointAsync("settings-shortcut-id-search-narrow");
  });

  test("Settings keeps its page and scroll position when its tab becomes active again and when it moves to another group", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const note = "document/notes.note/2";
    await SettingsFixture.openPageAsync(window, "Keyboard shortcuts");
    const top = await window.locator(".nol-settings-content").evaluate(async t => {
      t.scrollTop = 120;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return t.scrollTop;
    });
    expect(top).toBeGreaterThan(0);

    await TabDragFixture.tab(window, note).click();
    await expect(window.locator("nol-settings")).toBeHidden();
    await settingsTab(window).click();
    await expectSamePageAsync(window, top);

    await TabDragFixture.dragOntoPlateAsync(window, settingsKey, note, "Right");
    await window.mouse.up();

    await expect(window.locator("nol-tab-group").filter({ has: window.locator("nol-tab[data-tab-key^='document/']") })).toHaveCount(2);
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, settingsKey))).toEqual([settingsKey]);
    await expectSamePageAsync(window, top);
  });

  test("changing the mode, a font and a size repaints the window at once, marks them modified, and Reset returns each", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openPageAsync(window, "Appearance");
    const mode = await otherModeAsync(window);
    const before = await window.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily, size: getComputedStyle(document.documentElement).fontSize }));

    await chooseAsync(window, "desktop.mode", mode);
    await chooseAsync(window, "desktop.interfaceFont", "System");
    await row(window, "desktop.panelSize").locator("input").fill("15");
    await row(window, "desktop.panelSize").locator("input").press("Enter");

    await expect.poll(() => window.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(WindowModeFixture.backgrounds[mode]);
    await expect.poll(() => nativeBackgroundAsync(mainProcess)).toBe(mode === "Dark" ? "#181818" : "#F8F8F8");
    await expect.poll(async () => parseFloat(await rootFontSizeAsync(window))).toBeCloseTo(16 * 15 / 13, 2);
    for (const field of [row(window, "desktop.panelSize").locator("input"), window.getByRole("searchbox", { name: "Search settings" })])
      expect(await field.evaluate(t => parseFloat(getComputedStyle(t).fontSize))).toBeCloseTo(15, 2);
    expect(await window.evaluate(() => getComputedStyle(document.body).fontFamily)).not.toBe(before.font);
    await expect(window.locator("nol-setting-row .nol-setting-row-marker")).toHaveCount(3);
    await mainProcess.checkpointAsync("settings-changed");
    for (const name of ["desktop.mode", "desktop.interfaceFont", "desktop.panelSize"])
      await row(window, name).getByRole("button", { name: /^Reset / }).click();
    await expect(window.locator("nol-setting-row .nol-setting-row-marker")).toHaveCount(0);
    await expect.poll(() => rootFontSizeAsync(window)).toBe(before.size);
    expect(await window.evaluate(() => getComputedStyle(document.body).fontFamily)).toBe(before.font);
  });

  test("a size outside its range stays as typed with its error after focus leaves, applies once corrected, and Escape puts the stored size back", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openPageAsync(window, "Appearance");
    const field = row(window, "desktop.panelSize").locator("input");
    const alert = row(window, "desktop.panelSize").getByRole("alert");
    const before = await rootFontSizeAsync(window);

    await field.fill("30");
    await field.press("Tab");

    await expect(field).not.toBeFocused();
    await expect(field).toHaveValue("30");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(alert).toHaveText("Enter a whole number from 12 to 18.");
    await expect(row(window, "desktop.panelSize").locator(".nol-setting-row-marker")).toHaveCount(0);
    expect(await rootFontSizeAsync(window)).toBe(before);
    await mainProcess.checkpointAsync("settings-number-error");
    await field.fill("15");
    await field.press("Enter");
    await expect(alert).toHaveCount(0);
    await expect(field).not.toHaveAttribute("aria-invalid");
    await expect.poll(async () => parseFloat(await rootFontSizeAsync(window))).toBeCloseTo(16 * 15 / 13, 2);
    await field.fill("40");
    await field.press("Enter");
    await expect(alert).toBeVisible();
    await field.press("Escape");
    await expect(field).toHaveValue("15");
    await expect(alert).toHaveCount(0);
    await expect(field).toBeFocused();
  });

  test("a checked checkbox centres its drawn tick in its box and has the hover radius, also at the largest panel size", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openAsync(window);
    const measureAsync = async (): Promise<readonly [number, number, string, string]> => {
      await SettingsFixture.choosePageAsync(window, "Notifications");
      const control = row(window, "desktop.mutedModules").locator(".nol-checkbox-control").first();
      await expect(control.locator("input")).toBeChecked();
      return await control.evaluate(t => {
        const input = t.querySelector<HTMLInputElement>("input");
        if (input === null)
          throw new Error("Nothing matches input.");
        const path = t.querySelector<SVGPathElement>(".nol-checkbox-mark path");
        if (path === null)
          throw new Error("Nothing matches .nol-checkbox-mark path.");
        const box = input.getBoundingClientRect();
        const tick = path.getBoundingClientRect();
        const probe = document.createElement("div");
        probe.style.borderTopLeftRadius = "var(--nol-radius-hover)";
        document.body.append(probe);
        const hover = getComputedStyle(probe).borderTopLeftRadius;
        probe.remove();
        return [
          Math.abs(tick.left + tick.right - box.left - box.right) / 2,
          Math.abs(tick.top + tick.bottom - box.top - box.bottom) / 2,
          getComputedStyle(input).borderTopLeftRadius,
          hover
        ] as const;
      });
    };

    const regular = await measureAsync();
    await SettingsFixture.choosePageAsync(window, "Appearance");
    await row(window, "desktop.panelSize").locator("input").fill("18");
    await row(window, "desktop.panelSize").locator("input").press("Enter");
    await expect.poll(async () => parseFloat(await rootFontSizeAsync(window))).toBeCloseTo(16 * 18 / 13, 2);
    const largest = await measureAsync();

    for (const [horizontal, vertical, radius, hover] of [regular, largest]) {
      expect(horizontal).toBeLessThanOrEqual(0.5);
      expect(vertical).toBeLessThanOrEqual(0.5);
      expect(radius).toBe(hover);
    }
    await mainProcess.checkpointAsync("settings-checkbox");
  });

  test("a checked checkbox keeps its tick in the forced text color in forced colors", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openAsync(window);
    await window.getByRole("treeitem", { name: "Notifications", exact: true }).click();
    const control = row(window, "desktop.mutedModules").locator(".nol-checkbox-control").first();
    await expect(control.locator("input")).toBeChecked();
    const readAsync = (): Promise<readonly [boolean, string, string, string]> => control.evaluate(t => {
      const markElement = t.querySelector(".nol-checkbox-mark");
      if (markElement === null)
        throw new Error("Nothing matches .nol-checkbox-mark.");
      const input = t.querySelector("input");
      if (input === null)
        throw new Error("Nothing matches input.");
      const mark = getComputedStyle(markElement);
      const probe = document.createElement("span");
      probe.style.color = "CanvasText";
      document.body.append(probe);
      const forced = getComputedStyle(probe).color;
      probe.remove();
      return [matchMedia("(forced-colors: active)").matches, mark.stroke, forced, getComputedStyle(input).backgroundColor] as const;
    });

    await MediaFixture.emulateAsync(window, { forcedColors: "active" });
    const [isForced, stroke, text, background] = await readAsync();

    expect(isForced).toBe(true);
    expect(stroke).toBe(text);
    expect(stroke).not.toBe(background);
    await mainProcess.checkpointAsync("settings-checkbox-forced-colors");
  });

  test("the Mode pills are one radio group: the checked pill is the tab stop and the arrow keys move the choice", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openPageAsync(window, "Appearance");
    const pill = (name: string): Locator => row(window, "desktop.mode").getByRole("radiogroup", { name: "Mode" }).getByRole("radio", { name, exact: true });
    const backgroundAsync = (): Promise<string> => window.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await expect(row(window, "desktop.mode").getByRole("radio")).toHaveText(["Light", "Dark", "System"]);
    await pill("Light").click();
    await expect.poll(backgroundAsync).toBe(WindowModeFixture.backgrounds.Light);
    await window.keyboard.press("ArrowRight");
    await expect(pill("Dark")).toBeChecked();
    await expect(pill("Dark")).toBeFocused();
    await expect.poll(backgroundAsync).toBe(WindowModeFixture.backgrounds.Dark);
    await window.keyboard.press("ArrowRight");
    await expect(pill("System")).toBeChecked();
    await window.keyboard.press("ArrowRight");
    await expect(pill("Light")).toBeChecked();
    await window.keyboard.press("End");
    await expect(pill("System")).toBeChecked();
    await window.keyboard.press("ArrowLeft");
    await expect(pill("Dark")).toBeChecked();
    await expect(pill("System")).toHaveAttribute("tabindex", "-1");
    await expect(pill("Dark")).toHaveAttribute("tabindex", "0");
    await mainProcess.checkpointAsync("settings-mode-pills");
  });

  test("choosing a setting's default by hand removes its Modified marker and Reset, also after a restart", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openPageAsync(window, "Appearance");
    const mode = row(window, "desktop.mode");

    await chooseAsync(window, "desktop.mode", "Dark");
    await expect(mode.locator(".nol-setting-row-marker")).toHaveCount(1);
    await expect(mode.getByRole("button", { name: /^Reset / })).toHaveCount(1);
    await chooseAsync(window, "desktop.mode", "System");

    await expect(mode.locator(".nol-setting-row-marker")).toHaveCount(0);
    await expect(mode.getByRole("button", { name: /^Reset / })).toHaveCount(0);
    await mainProcess.checkpointAsync("settings-default-by-hand");
    await mainProcess.restartAsync();
    await SettingsFixture.openPageAsync(mainProcess.window, "Appearance");
    await expect(row(mainProcess.window, "desktop.mode").getByRole("radio", { name: "System" })).toBeChecked();
    await expect(row(mainProcess.window, "desktop.mode").locator(".nol-setting-row-marker")).toHaveCount(0);
    await expect(row(mainProcess.window, "desktop.mode").getByRole("button", { name: /^Reset / })).toHaveCount(0);
  });

  test("a restart paints the first frame in the chosen mode, before the runtime has given the window any setting", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await SettingsFixture.openPageAsync(window, "Appearance");
    const mode = await otherModeAsync(window);
    await chooseAsync(window, "desktop.mode", mode);
    await expect.poll(() => window.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(WindowModeFixture.backgrounds[mode]);

    await mainProcess.restartAsync(async () => {
      for (const file of ["desktop.sqlite", "desktop.sqlite-wal", "desktop.sqlite-shm"])
        await rm(path.join(mainProcess.dataDirectory, file), { force: true });
      await writeFile(path.join(mainProcess.dataDirectory, "conversations.json"), "[]");
    });

    await expect(mainProcess.window.getByRole("heading", { name: "Data from an earlier Noldova Desktop Sample" })).toBeVisible();
    await expect(mainProcess.window.locator("nol-workspace")).toHaveCount(0);
    expect(await mainProcess.window.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.documentElement).colorScheme]))
      .toEqual([WindowModeFixture.backgrounds[mode], mode.toLowerCase()]);
    expect(await nativeBackgroundAsync(mainProcess)).toBe(mode === "Dark" ? "#181818" : "#F8F8F8");
    await mainProcess.checkpointAsync("settings-first-frame");
  });
});

test.describe("settings on macOS", () => {
  test.skip(process.platform !== "darwin", "Windows and Linux open Settings by its key and command search.");

  test("Settings… in the application menu shows its key and opens Settings @smoke", async ({ mainProcess }) => {
    const item = (): Promise<readonly [string, boolean, string] | null> => mainProcess.application.evaluate(({ Menu }) => {
      const found = Menu.getApplicationMenu()?.getMenuItemById("desktop.app/desktop.settings/0");
      return found ? [found.label, found.enabled, String(found.accelerator)] as const : null;
    });

    await expect.poll(item).toEqual(["Settings…", true, "Command+,"]);
    await mainProcess.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("desktop.app/desktop.settings/0")?.click());

    await expect(mainProcess.window.locator("nol-settings")).toBeVisible();
    await expect(settingsTab(mainProcess.window)).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("settings opened while the window starts", () => {
  test.use({ mainProcessDataFiles: { [NotesOptionsFixture.HOLD_FIRST_MARKER]: String.empty } });

  test("a Settings tab opened by its key before the window first loads its layout is still open and active after the layout loads", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await expect.poll(() => NotesOptionsFixture.heldAsync(window)).toBe(1);
    await SettingsFixture.openAsync(window);
    await expect(settingsTab(window)).toHaveAttribute("aria-selected", "true");
    await NotesOptionsFixture.releaseAsync(window);

    await expect(window.locator("[data-fixture-content]").first()).toBeAttached();
    await expect(settingsTab(window)).toHaveCount(1);
    await expect(settingsTab(window)).toHaveAttribute("aria-selected", "true");
    await expect(window.locator("nol-settings")).toBeVisible();
  });
});
