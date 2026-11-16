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
import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

function tag(window: Page, id: number): Locator {
  return window.locator(`[data-tab-content="document/notes.note/${id}"]`).getByRole("textbox", { name: "Tag" });
}

function pane(window: Page): Locator {
  return window.locator(".cdk-overlay-container .nol-search-pane");
}

function field(window: Page): Locator {
  return window.getByRole("combobox", { name: /^Search / });
}

function searchField(window: Page): Locator {
  return window.locator("nol-window-row .nol-window-row-search");
}

async function layOutAsync(mainProcess: MainProcessFixture, width: number): Promise<void> {
  await test.step(`lay the window out ${width} CSS px wide, since the hosted runners' display size varies`, async () => {
    const shown = await mainProcess.window.evaluate(() => innerWidth);
    await mainProcess.zoomAsync(shown / width, width);
  });
}

function options(window: Page): Locator {
  return pane(window).getByRole("option");
}

function headings(window: Page): Locator {
  return pane(window).locator(".nol-quick-input-heading");
}

test.describe("search", () => {
  test.describe("in a window it sizes itself", () => {
    test.use({ mainProcessWindowPlacement: true });

    test("shows a field centred in the window row that opens search over it, finds a module's command, runs it from the keyboard and lists it as recent next time @smoke", async ({ mainProcess }) => {
      const window = mainProcess.window;
      await layOutAsync(mainProcess, 1280);
      const tab = window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]");
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tag(window, 2)).toBeFocused();
      const shown = await searchField(window).evaluate(t => {
        const row = t.closest("nol-window-row");
        if (row === null)
          throw new Error("The search field is outside the window row.");
        const box = t.getBoundingClientRect();
        const edges = row.getBoundingClientRect();
        const parts = [".nol-window-row-search-glyph", ".nol-window-row-search-text", ".nol-window-row-search-key"].map(u => t.querySelector(u)?.textContent.trim() ?? "");
        return {
          text: parts.join(" "),
          centre: box.left + box.width / 2 - innerWidth / 2,
          middle: box.top + box.height / 2 - (edges.top + edges.height / 2),
          width: box.width / parseFloat(getComputedStyle(document.documentElement).fontSize),
          border: getComputedStyle(t).borderTopColor,
          isDark: matchMedia("(prefers-color-scheme: dark)").matches
        };
      });

      expect(shown.text).toMatch(/^search Search commands and settings (Ctrl\+K|⌘K)$/);
      expect(Math.abs(shown.centre)).toBeLessThan(1);
      expect(Math.abs(shown.middle)).toBeLessThan(1);
      expect(shown.width).toBeCloseTo(27.5, 1);
      expect(shown.border).toBe(shown.isDark ? "rgb(69, 69, 69)" : "rgb(206, 206, 206)");
      await window.keyboard.press("ControlOrMeta+KeyK");

      await expect(field(window)).toBeFocused();
      await expect(field(window)).toHaveValue(String.empty);
      await expect(searchField(window)).toHaveCSS("opacity", "0");
      const row = await window.locator("nol-window-row").boundingBox();
      const place = await searchField(window).boundingBox();
      const box = await pane(window).boundingBox();
      const palette = await pane(window).locator("nol-quick-input").boundingBox();
      const width = await window.evaluate(() => document.documentElement.clientWidth);
      expect(Math.abs((palette?.y ?? Number.NaN) - (place?.y ?? Number.NaN)), JSON.stringify({ row, place, palette })).toBeLessThanOrEqual(0.5);
      expect((place?.y ?? 0) > (row?.y ?? 0)).toBe(true);
      const edge = await pane(window).locator("nol-quick-input").evaluate(t => ["Top", "Right", "Bottom", "Left"].map(u => getComputedStyle(t).getPropertyValue(`border-${u.toLowerCase()}-color`)));
      expect(edge).toEqual(Array<string>(4).fill(shown.border));
      expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - width / 2)).toBeLessThan(1);
      await expect(pane(window).locator(".nol-search-filter")).toHaveText(["All", "Commands", "Settings"]);
      await expect(pane(window).locator(".nol-search-hint")).toHaveText(["Enter to open", "↑ ↓ to move", "Tab for the next filter", "Type > for commands only"]);

      await window.keyboard.type("new n");
      await expect(headings(window).first()).toHaveText("Best match");
      await expect(options(window).first().locator(".nol-quick-input-title")).toHaveText("New note");
      await expect(options(window).first().locator("mark")).toHaveText(["New n"]);
      await mainProcess.checkpointAsync("search-best-match");
      await window.keyboard.press("Enter");

      await expect(pane(window)).toHaveCount(0);
      await expect(searchField(window)).toHaveCSS("opacity", "1");
      await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/3\"] .nol-tab-label")).toHaveText("Note 3");

      await window.keyboard.press("ControlOrMeta+KeyK");
      await expect(headings(window)).toHaveText(["Recent commands"]);
      await expect(options(window)).toHaveCount(1);
      await expect(options(window).first().locator(".nol-quick-input-title")).toHaveText("New note");
      await mainProcess.checkpointAsync("search-open");
      await window.keyboard.press("Escape");
    });

    test("keeps a narrow field unshifted in its group when the row has no room to centre it", async ({ mainProcess }) => {
      const window = mainProcess.window;
      await expect(searchField(window)).toBeVisible();
      const narrow = await window.locator("nol-window-row .nol-window-row-middle").evaluate(t => {
        const style = getComputedStyle(t);
        const room = t.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const field = 27.5 * parseFloat(getComputedStyle(document.documentElement).fontSize);
        return Math.round(innerWidth - room + field / 2);
      });
      await layOutAsync(mainProcess, narrow);
      const shown = await searchField(window).evaluate(t => {
        const middle = t.closest(".nol-window-row-middle");
        if (middle === null)
          throw new Error("The search field is outside the row's middle group.");
        const box = t.getBoundingClientRect();
        const group = middle.getBoundingClientRect();
        return {
          shift: t.style.translate,
          inGroup: box.left + box.width / 2 - (group.left + group.width / 2),
          inWindow: box.left + box.width / 2 - innerWidth / 2,
          width: box.width / parseFloat(getComputedStyle(document.documentElement).fontSize)
        };
      });

      expect(shown.width).toBeLessThan(27.5);
      expect(shown.shift).toBe("0px");
      expect(Math.abs(shown.inGroup)).toBeLessThan(1);
      expect(Math.abs(shown.inWindow)).toBeGreaterThan(1);
    });
  });

  test("shows the field's shortcut with no border in light, dark and forced colors, as large as a bordered key", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const key = searchField(window).locator(".nol-window-row-search-key");
    await expect(key).toBeVisible();
    const readAsync = (): Promise<readonly unknown[]> => key.evaluate(t => {
      const style = getComputedStyle(t);
      const bordered = t.cloneNode(true);
      if (!(bordered instanceof HTMLElement))
        throw new Error("The key's copy is not an element.");
      bordered.style.padding = "0.0625rem 0.3125rem";
      bordered.style.border = "var(--nol-border-width) solid";
      const token = document.createElement("span");
      token.style.position = "absolute";
      token.style.width = "var(--nol-border-width)";
      t.after(bordered, token);
      const box = t.getBoundingClientRect();
      const edged = bordered.getBoundingClientRect();
      const edges = getComputedStyle(bordered);
      const border = token.getBoundingClientRect().width;
      const width = edged.width + 2 * border - parseFloat(edges.borderLeftWidth) - parseFloat(edges.borderRightWidth);
      const height = edged.height + 2 * border - parseFloat(edges.borderTopWidth) - parseFloat(edges.borderBottomWidth);
      bordered.remove();
      token.remove();
      return [
        [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
        Math.abs(box.width - width) < 0.5,
        Math.abs(box.height - height) < 0.5
      ];
    });
    const readings: (readonly unknown[])[] = [];

    for (const media of [{ colorScheme: "light", forcedColors: null }, { colorScheme: "dark", forcedColors: null }, { colorScheme: null, forcedColors: "active" }] as const) {
      await MediaFixture.emulateAsync(window, media);
      readings.push(await readAsync());
    }
    await MediaFixture.emulateAsync(window, { colorScheme: null, forcedColors: null });

    expect(readings).toEqual(Array(3).fill([["0px", "0px", "0px", "0px"], true, true]));
  });

  test("finds a setting by its page and title and opens Settings at it", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await searchField(window).click();
    await expect(field(window)).toBeFocused();
    await window.keyboard.type("time format");
    const option = pane(window).locator("[data-item=\"desktop.settings/desktop.timeFormat\"]");
    await expect(option.locator(".nol-quick-input-title")).toHaveText("General: Time format");
    await expect(option.locator(".nol-quick-input-detail")).toHaveText("Settings › General");

    await option.click();

    await expect(pane(window)).toHaveCount(0);
    const row = window.locator("[data-setting=\"desktop.timeFormat\"]");
    await expect(row).toBeInViewport();
    await expect(row.locator("input, select, textarea, button").first()).toBeFocused();
  });

  test("steps through its filters with Tab and Shift+Tab, showing all of a source's matches under its filter, and keeps the focus in its field", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await searchField(window).click();
    await expect(field(window)).toBeFocused();
    await window.keyboard.type("tab");
    await expect(headings(window).first()).toHaveText("Best match");
    const pressed = pane(window).locator(".nol-search-filter[aria-pressed=\"true\"]");

    await window.keyboard.press("Tab");
    await expect(pressed).toHaveText(/^Commands/);
    await expect(headings(window)).toHaveText(["Commands"]);
    expect(await options(window).count()).toBeGreaterThan(2);
    await expect(field(window)).toBeFocused();
    await window.keyboard.press("Shift+Tab");
    await expect(pressed).toHaveText("All");
    await window.keyboard.press("Shift+Tab");
    await expect(pressed).toHaveText(/^Settings/);
    await pane(window).locator(".nol-search-filter").first().click();
    await expect(pressed).toHaveText("All");
    await expect(field(window)).toBeFocused();
    for (const mode of WindowModeFixture.modes) {
      await WindowModeFixture.setAsync(window, mode);
      await mainProcess.checkpointAsync(`search-filters-${mode.toLowerCase()}`);
    }
    await window.keyboard.press("Escape");
    await expect(searchField(window)).toBeFocused();
  });

  test("opens with > for the commands alone from the command search key, listing every command", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await window.keyboard.press("ControlOrMeta+Shift+KeyP");

    await expect(field(window)).toHaveValue(">");
    await expect(pane(window).locator(".nol-search-filter")).toHaveText(["All", "Commands"]);
    await expect(headings(window)).toHaveText(["Commands"]);
    expect(await options(window).count()).toBeGreaterThan(10);
    await window.keyboard.press("Escape");
    await expect(pane(window)).toHaveCount(0);
  });

  test("selects the query with Shift and Home or End, leaving the list where it is, while Home and End alone move through the list", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const selection = (): Promise<number[]> => field(window).evaluate((input: HTMLInputElement) => [input.selectionStart ?? -1, input.selectionEnd ?? -1]);
    const idOf = async (option: Locator): Promise<string> => {
      const id = await option.getAttribute("id");
      if (Object.isNull(id))
        throw new Error("The option has no id.");
      return id;
    };
    await CommandSearchFixture.searchAsync(window, " new note");
    await expect(options(window).first().locator("mark")).toHaveText(["New note"]);
    await expect(pane(window).locator("nol-quick-input")).toHaveAttribute("data-searching", "false");
    await expect(options(window).nth(1)).toBeVisible();
    const first = await idOf(options(window).first());
    const last = await idOf(options(window).last());

    await window.keyboard.press("End");
    await expect(field(window)).toHaveAttribute("aria-activedescendant", last);
    await expect.poll(selection).toEqual([10, 10]);
    await window.keyboard.press("Shift+Home");
    await expect.poll(selection).toEqual([0, 10]);
    await expect(field(window)).toHaveAttribute("aria-activedescendant", last);
    await window.keyboard.press("ArrowLeft");
    await expect.poll(selection).toEqual([0, 0]);
    await window.keyboard.press("Shift+End");
    await expect.poll(selection).toEqual([0, 10]);
    await expect(field(window)).toHaveAttribute("aria-activedescendant", last);
    await window.keyboard.press("Home");
    await expect(field(window)).toHaveAttribute("aria-activedescendant", first);
    await window.keyboard.press("Escape");

    await expect(pane(window)).toHaveCount(0);
  });

  test("runs a runtime part's command chosen with the pointer, leaves out a disabled command, says when nothing is found, and returns focus when dismissed", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const ticks = window.locator("[data-fixture-content=clock-ticks]");
    const tab = window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]");
    await expect(ticks).toHaveText("No ticks");

    await searchField(window).click();
    await expect(field(window)).toBeFocused();
    await window.keyboard.type("tick");
    await pane(window).locator("[data-item=\"desktop.commands/clock.tick\"]").click();

    await expect(ticks).toHaveText("Ticks: 1");
    await expect(pane(window)).toHaveCount(0);
    await expect(searchField(window)).toBeFocused();
    await tab.click();
    await expect(tag(window, 2)).toBeFocused();

    await CommandSearchFixture.searchAsync(window, "keep the tab");
    await expect(pane(window).locator(".nol-quick-input-empty")).toHaveText("Nothing found.");
    await expect(options(window)).toHaveCount(0);
    await window.keyboard.press("Escape");

    await expect(pane(window)).toHaveCount(0);
    await expect(tag(window, 2)).toBeFocused();
  });

  test("lists a menu item that passes arguments under its menu, beside the command it runs, and runs it from the pointer", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await CommandSearchFixture.searchAsync(window, "new note");
    const command = pane(window).locator("[data-item=\"desktop.commands/notes.newNote\"]");
    const item = pane(window).locator("[role=option][data-item^=\"desktop.commands/desktop.file/\"]");

    await expect(command.locator("mark")).toHaveText(["New note"]);
    await expect(options(window)).toHaveCount(2);
    await expect(item.locator(".nol-quick-input-detail")).toHaveText("File › New from template");
    await expect(item.locator(".nol-quick-input-key")).toHaveCount(0);
    await mainProcess.checkpointAsync("search-menu-item");
    await item.click();

    await expect(pane(window)).toHaveCount(0);
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/3\"] .nol-tab-label")).toHaveText("Note 3");
  });

  test("lists each focus command once, leaving out the View menu items that run them without arguments", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await CommandSearchFixture.searchAsync(window, "focus");

    await expect(options(window).and(window.locator("[data-item=\"desktop.commands/desktop.focusNextGroup\"]"))).toHaveCount(1);
    await expect(options(window).and(window.locator("[data-item=\"desktop.commands/desktop.focusPreviousGroup\"]"))).toHaveCount(1);
    await expect(options(window).and(window.locator("[data-item^=\"desktop.commands/desktop.view/\"]"))).toHaveCount(0);
  });

  test("a query keeps the commands that contain it as one run, and marks the run in the title without changing its text", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const rows = (): Promise<readonly (readonly [string, string, string, readonly string[]])[]> => options(window).evaluateAll(items => items.map(item => [
      item.getAttribute("data-item") ?? "",
      item.querySelector(".nol-quick-input-detail")?.textContent ?? "",
      item.querySelector(".nol-quick-input-title")?.textContent ?? "",
      [...item.querySelectorAll("mark")].map(t => t.textContent ?? "")
    ] as const));
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
    await CommandSearchFixture.searchAsync(window, String());
    await expect(options(window).first()).toBeVisible();
    const all = await rows();
    const expected = all.filter(t => `${t[1]} ${t[2]}`.toLowerCase().includes("tab")).map(t => t[0]).sort();

    await window.keyboard.type(" tab");
    await expect.poll(async () => (await rows()).map(t => t[0]).sort()).toEqual(expected);
    const found = await rows();

    expect(found.length).toBeGreaterThan(0);
    expect(found.every(t => t[3].length === 1 && t[3][0]?.toLowerCase() === "tab")).toBe(true);
    expect(found.map(t => [t[1], t[2]])).toEqual(found.map(t => all.find(u => u[0] === t[0])).map(t => [t?.[1], t?.[2]]));
    for (const mode of WindowModeFixture.modes) {
      await WindowModeFixture.setAsync(window, mode);
      await mainProcess.checkpointAsync(`search-match-${mode.toLowerCase()}`);
    }
    await window.keyboard.press("Escape");
  });

  test("keeps its list to 60% of the window's height in a tall window, and to ten rows in a short one", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();

    for (const [width, height, name] of [[1920, 1080, "tall"], [900, 460, "short"]] as const) {
      await mainProcess.useViewportAsync(width, height);
      await CommandSearchFixture.searchAsync(window, String());
      await expect(options(window).first()).toBeVisible();
      const list = await pane(window).locator(".nol-quick-input-list").evaluate(element => {
        const option = element.querySelector<HTMLElement>("[role=option]");
        if (option === null)
          throw new Error("Nothing matches [role=option].");
        const style = getComputedStyle(element);
        return {
          height: element.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
          row: option.getBoundingClientRect().height,
          scrolls: element.scrollHeight > element.clientHeight,
          share: innerHeight * 0.6
        };
      });

      expect(list.scrolls).toBe(true);
      expect(Math.abs(list.height - (name === "tall" ? list.share : list.row * 10)), JSON.stringify(list)).toBeLessThan(1);
      expect(list.row * 10 > list.share).toBe(name === "short");
      await mainProcess.checkpointAsync(`search-height-${name}`);
      await window.keyboard.press("Escape");
      await expect(pane(window)).toHaveCount(0);
    }
  });

  test("lists the commands last run from it under Recent commands, newest first, then the others by title, and keeps them after a restart", async ({ mainProcess }) => {
    const ids = (): Promise<readonly string[]> => options(window).evaluateAll(items => items.map(t => t.getAttribute("data-item") ?? ""));
    let window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();

    await CommandSearchFixture.searchAsync(window, " new n");
    await pane(window).locator("[data-item=\"desktop.commands/notes.newNote\"]").click();
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/3\"]")).toBeVisible();
    await CommandSearchFixture.searchAsync(window, " tick");
    await pane(window).locator("[data-item=\"desktop.commands/clock.tick\"]").click();
    await expect(window.locator("[data-fixture-content=clock-ticks]")).toHaveText("Ticks: 1");

    await CommandSearchFixture.searchAsync(window, String());
    await expect(headings(window)).toHaveText(["Recent commands", "Commands"]);
    const listed = await ids();
    expect(listed.slice(0, 2)).toEqual(["desktop.commands/clock.tick", "desktop.commands/notes.newNote"]);
    expect(new Set(listed).size).toBe(listed.length);
    const titles = await options(window).evaluateAll(items => items.slice(2).map(t => t.querySelector(".nol-quick-input-title")?.textContent ?? ""));
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    await expect(options(window).first()).toHaveAccessibleName(/./);
    for (const mode of WindowModeFixture.modes) {
      await WindowModeFixture.setAsync(window, mode);
      await mainProcess.checkpointAsync(`search-recent-${mode.toLowerCase()}`);
    }
    await WindowModeFixture.setAsync(window, "Light");
    await window.keyboard.press("Escape");

    await mainProcess.restartAsync();
    window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
    await window.keyboard.press("ControlOrMeta+KeyK");
    await expect(headings(window)).toHaveText(["Recent commands"]);
    await expect.poll(async () => (await ids()).slice(0, 2)).toEqual(["desktop.commands/clock.tick", "desktop.commands/notes.newNote"]);
    await window.keyboard.press("Escape");
  });

  test("every result's title starts at the same left edge, with or without an icon", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();

    await CommandSearchFixture.searchAsync(window, String());
    await expect(options(window).first()).toBeVisible();

    const titles = await options(window).evaluateAll(items => items.map(item => ({
      icon: item.querySelector(".nol-quick-input-icon")?.textContent?.trim() ?? "",
      left: item.querySelector(".nol-quick-input-title")?.getBoundingClientRect().left ?? -1,
      iconWidth: item.querySelector(".nol-quick-input-icon")?.getBoundingClientRect().width ?? -1
    })));
    expect(titles.some(t => t.icon !== String.empty)).toBe(true);
    expect(new Set(titles.map(t => t.left)).size).toBe(1);
    expect(new Set(titles.map(t => t.iconWidth)).size).toBe(1);
    await mainProcess.checkpointAsync("search-icon-column");
    await window.keyboard.press("Escape");
  });
});

test.describe("search over a held start", () => {
  test.use({ mainProcessDataFiles: { "conversations.json": "[]" } });

  test("lists the commands that the end of the start brings while it is open, without the person typing again", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const tick = pane(window).locator("[data-item=\"desktop.commands/clock.tick\"]");
    await expect(window.getByRole("heading", { name: /^Data from an earlier / })).toBeVisible();

    await CommandSearchFixture.searchAsync(window, "tick");
    await expect(pane(window).locator(".nol-quick-input-empty")).toHaveText("Nothing found.");
    expect(await PageBridgeFixture.evaluateAsync(window, t => t.actOnStartup("moveAside"))).toBe(true);

    await expect(tick).toBeVisible();
    await expect(field(window)).toHaveValue(">tick");
  });
});

test.describe("search over a feed", () => {
  test.use({ mainProcessDataFiles: { "modules/notes/feed": String.empty } });

  test("keeps Up and Down in its list when it opens over a focused feed or one of its messages, from its key and from the window row's field", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await window.locator("nol-tab[data-tab-key=\"document/notes.feed/messages\"]").click();
    const feed = window.locator("[data-tab-content=\"document/notes.feed/messages\"] nol-notes-feed .nol-notes-feed-list");
    const view = feed.locator("[role=feed][tabindex=\"0\"]");
    const message = feed.locator("[role=article][tabindex=\"-1\"]").last();
    await expect(view).toBeVisible();
    await expect(message).toBeVisible();
    const openers: readonly (() => Promise<void>)[] = [
      () => window.keyboard.press("ControlOrMeta+Shift+KeyP"),
      () => searchField(window).click()
    ];

    for (const [target, openAsync] of [view, message].flatMap(t => openers.map(u => [t, u] as const))) {
      await target.focus();
      await expect(target).toBeFocused();
      await openAsync();
      await expect(field(window)).toBeFocused();
      await window.keyboard.press("End");
      await window.keyboard.type("e");
      await expect(options(window).nth(1)).toBeVisible();
      await window.keyboard.press("ArrowDown");

      await expect(options(window).nth(1)).toHaveAttribute("aria-selected", "true");
      await expect(field(window)).toBeFocused();
      await window.keyboard.press("Escape");
      await expect(pane(window)).toHaveCount(0);
    }
  });
});
