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
import { TabDragFixture } from "./fixtures/tab-drag.fixture.ts";
import { TabRowFixture } from "./fixtures/tab-row.fixture.ts";

const notes = "view/notes.list";
const firstNote = "document/notes.note/1";
const secondNote = "document/notes.note/2";
const thirdNote = "document/notes.note/3";

async function runCommandAsync(window: Page, title: string, name: string): Promise<void> {
  await CommandSearchFixture.searchAsync(window, title);
  await expect(window.getByRole("option").first()).toHaveAttribute("data-item", `desktop.commands/${name}`);
  await window.keyboard.press("Enter");
}

async function chooseRowAsync(window: Page, label: string, key: string = "Enter"): Promise<void> {
  for (let step = 0; step < 12; step++) {
    const current = await window.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    if (current.includes(label)) {
      await window.keyboard.press(key);
      return;
    }
    await window.keyboard.press("ArrowDown");
  }
  throw new Error(`The menu has no row ${label}.`);
}

async function openTabMenuAsync(window: Page, key: string): Promise<void> {
  await TabDragFixture.tab(window, key).focus();
  await window.keyboard.press("Shift+F10");
  await expect(window.locator(".cdk-overlay-container nol-menu[data-place='desktop.tab']")).toBeVisible();
  await expect.poll(() => window.evaluate(() => document.activeElement?.closest("nol-menu") !== null && document.activeElement?.closest("nol-menu") !== undefined)).toBe(true);
}

function documentGroups(window: Page): Locator {
  return window.locator("nol-tab-group").filter({ has: window.locator("nol-tab[data-tab-key^='document/']") });
}

async function splitFirstNoteAsync(window: Page): Promise<void> {
  await TabDragFixture.dragOntoPlateAsync(window, firstNote, secondNote, "Right");
  await window.mouse.up();
  await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([firstNote]);
}

test.describe("document groups", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(TabDragFixture.tab(mainProcess.window, firstNote)).toBeVisible();
    await expect(TabDragFixture.tab(mainProcess.window, secondNote)).toBeVisible();
  });

  for (const [direction, axis] of [["Left", "x"], ["Right", "x"], ["Top", "y"], ["Bottom", "y"]] as const) {
    test(`a document's ${direction.toLowerCase()} arrow splits its group and shows no dock guides`, async ({ mainProcess }) => {
      const window = mainProcess.window;
      await TabDragFixture.dragOntoPlateAsync(window, firstNote, secondNote, direction);

      await expect(window.locator(`nol-docking-plate [data-direction=${direction}]`)).toHaveClass(/nol-docking-guide-chosen/);
      await expect(window.locator(".nol-docking-side")).toHaveCount(0);
      await expect(window.locator(".nol-docking-preview")).toBeVisible();
      await window.mouse.up();

      await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([firstNote]);
      expect(await TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, secondNote))).toEqual([secondNote]);
      const moved = await TabDragFixture.groupOf(window, firstNote).boundingBox();
      const stayed = await TabDragFixture.groupOf(window, secondNote).boundingBox();
      expect((moved?.[axis] ?? 0) < (stayed?.[axis] ?? 0)).toBe(direction === "Left" || direction === "Top");
      await expect(documentGroups(window)).toHaveCount(2);
      await mainProcess.checkpointAsync(`document-split-${direction.toLowerCase()}`);
    });
  }

  test("a document dropped on another document group's center joins it, and the emptied group closes @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await splitFirstNoteAsync(window);

    await TabDragFixture.dragOntoPlateAsync(window, firstNote, secondNote, "Center");
    await expect(window.locator(".nol-docking-side")).toHaveCount(0);
    await window.mouse.up();

    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, secondNote))).toEqual([secondNote, firstNote]);
    await expect(documentGroups(window)).toHaveCount(1);
    await mainProcess.checkpointAsync("document-center-joins-group");
  });

  test("a document group's first tab and last action stand 0.25rem from its card's start and end, in light and dark and in both directions", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const group = documentGroups(window).first();
    for (const direction of ["ltr", "rtl"] as const) {
      await TabRowFixture.setDirectionAsync(window, direction);
      for (const scheme of ["light", "dark"] as const) {
        await MediaFixture.emulateAsync(window, { colorScheme: scheme });
        await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
        const insets = await TabRowFixture.insetsOf(group);

        expect(insets.firstTab).toBeCloseTo(insets.rem * 0.25, 0);
        expect(insets.lastAction).toBeCloseTo(insets.rem * 0.25, 0);
        await mainProcess.checkpointAsync(`document-tab-row-${direction}-${scheme}`);
      }
    }
  });

  test("End and Home in a tab row too narrow for its tabs focus its last and first tab and scroll each into view whole, clear of the actions and the overflow button, in both directions", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await splitFirstNoteAsync(window);
    const group = TabDragFixture.groupOf(window, secondNote);
    const scroller = group.locator(".nol-tab-group-scroller");
    const tabs = group.locator("nol-tab");
    await TabDragFixture.tab(window, secondNote).click();
    for (let count = 2; count <= 4; count++) {
      await window.keyboard.press("ControlOrMeta+Alt+KeyN");
      await expect(tabs).toHaveCount(count);
    }
    const excess = await group.evaluate(t => {
      const widest = Math.max(...[...t.querySelectorAll("nol-tab")].map(u => u.getBoundingClientRect().width));
      const actions = t.querySelector(".nol-tab-group-actions")?.getBoundingClientRect().width ?? 0;
      return t.getBoundingClientRect().width - widest - actions - Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 2;
    });
    const grip = await TabDragFixture.centerOfAsync(window.getByRole("separator", { name: "Resize the pane on the left" }));
    await window.mouse.move(grip.x, grip.y);
    await window.mouse.down();
    await window.mouse.move(grip.x - excess, grip.y, { steps: 10 });
    await window.mouse.up();
    await expect.poll(() => scroller.evaluate(t => t.scrollWidth > t.clientWidth), { message: "The narrowed row overflows" }).toBe(true);
    await expect(group.locator(".nol-tab-group-overflow")).toBeVisible();

    for (const direction of ["ltr", "rtl"] as const) {
      await TabRowFixture.setDirectionAsync(window, direction);
      await group.locator("nol-tab[aria-selected='true']").focus();
      await window.keyboard.press("Home");
      await expect(tabs.first()).toBeFocused();
      await expect.poll(() => TabRowFixture.clearanceOf(tabs.first()), { message: `Home scrolls the first tab into view, ${direction}` }).toBe(TabRowFixture.CLEAR);
      expect(Math.abs(await scroller.evaluate(t => t.scrollLeft))).toBeLessThanOrEqual(1);

      await window.keyboard.press("End");
      await expect(tabs.last()).toBeFocused();
      await expect.poll(() => TabRowFixture.clearanceOf(tabs.last()), { message: `End scrolls the last tab clear of the actions, ${direction}` }).toBe(TabRowFixture.CLEAR);
      const gap = await group.evaluate((t, rtl) => {
        const [last, actions] = [[...t.querySelectorAll("nol-tab")].at(-1)?.getBoundingClientRect(), t.querySelector(".nol-tab-group-actions")?.getBoundingClientRect()];
        return last === undefined || actions === undefined ? Number.NaN : rtl ? last.left - actions.right : actions.left - last.right;
      }, direction === "rtl");
      expect(Math.abs(gap), `End scrolls the row only as far as the last tab needs, ending where the actions start, ${direction}`).toBeLessThan(1);
      await mainProcess.checkpointAsync(`tab-row-narrow-end-${direction}`);
    }
  });

  test("over a tab row a dragged tab shows only an insertion line and drops there, while over the content a guide previews its area", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const line = window.locator(".nol-drop-line-before");
    const preview = window.locator(".nol-docking-preview");
    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await TabDragFixture.startAsync(window, firstNote);
      await TabDragFixture.moveOverAsync(window, TabDragFixture.tab(window, secondNote), 30);
      await expect(line).toHaveCount(1);
      await expect(line).toHaveClass(/nol-tab-group-end/);
      await expect(preview).toHaveCount(0);
      await expect(window.locator("nol-docking-plate")).toHaveCount(0);
      await mainProcess.checkpointAsync(`tab-row-insertion-${scheme}`);
      await TabDragFixture.moveOverAsync(window, TabDragFixture.groupOf(window, secondNote).locator(".nol-tab-group-actions"));
      await expect(line).toHaveClass(/nol-tab-group-end/);
      await expect(window.locator("nol-docking-plate")).toHaveCount(0);
      await TabDragFixture.moveOverAsync(window, TabDragFixture.groupOf(window, secondNote).locator("[role=tabpanel]"));
      await TabDragFixture.moveOverAsync(window, window.locator("nol-docking-plate [data-direction=Right]"));
      await expect(preview).toBeVisible();
      await expect(line).toHaveCount(0);
      const group = await TabDragFixture.groupOf(window, secondNote).boundingBox() ?? { x: 0, y: 0, width: 0, height: 0 };
      const box = await preview.boundingBox() ?? { x: 0, y: 0, width: 0, height: 0 };
      expect([box.x + box.width, box.y, box.height].map(t => Math.round(t))).toEqual([group.x + group.width, group.y, group.height].map(t => Math.round(t)));
      expect(box.x).toBeGreaterThanOrEqual(group.x + group.width / 2);
      await mainProcess.checkpointAsync(`tab-split-preview-${scheme}`);
      await window.keyboard.press("Escape");
      await window.mouse.up();
      await expect(preview).toHaveCount(0);
      await window.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      });
    }

    await TabDragFixture.startAsync(window, firstNote);
    await TabDragFixture.moveOverAsync(window, TabDragFixture.tab(window, secondNote), 30);
    await window.mouse.up();
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([secondNote, firstNote]);
    await expect(line).toHaveCount(0);
    await splitFirstNoteAsync(window);
    await TabDragFixture.startAsync(window, secondNote);
    await TabDragFixture.moveOverAsync(window, TabDragFixture.tab(window, firstNote), -30);
    await expect(TabDragFixture.tab(window, firstNote)).toHaveClass(/nol-drop-line-before/);
    const [lineLength, pillHeight] = await TabDragFixture.tab(window, firstNote).evaluate(t =>
      [getComputedStyle(t, "::after").height, getComputedStyle(t.querySelector(".nol-tab-pill") ?? t).height]);
    expect(lineLength).toBe(pillHeight);
    await expect(preview).toHaveCount(0);
    await window.mouse.up();

    await expect(documentGroups(window)).toHaveCount(1);
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([secondNote, firstNote]);
  });

  test("a document shows no plate over a views group", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await TabDragFixture.startAsync(window, firstNote);
    await TabDragFixture.moveOverAsync(window, TabDragFixture.groupOf(window, notes).locator("[role=tabpanel]"));

    await expect(window.locator("nol-docking-plate")).toHaveCount(0);
    await expect(window.locator(".nol-docking-side")).toHaveCount(0);
    await window.mouse.up();
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([firstNote, secondNote]);
  });

  test("the keyboard splits a document from its tab menu, moves it to the next or previous group and runs the move command from command search", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await openTabMenuAsync(window, firstNote);
    await chooseRowAsync(window, "Split", "ArrowRight");
    await chooseRowAsync(window, "Split right");

    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([firstNote]);
    await expect(TabDragFixture.tab(window, firstNote)).toBeFocused();
    await openTabMenuAsync(window, firstNote);
    await chooseRowAsync(window, "Move to previous group");
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, secondNote))).toEqual([secondNote, firstNote]);
    await expect(documentGroups(window)).toHaveCount(1);
    await expect(TabDragFixture.tab(window, firstNote)).toBeFocused();

    await openTabMenuAsync(window, secondNote);
    await chooseRowAsync(window, "Split", "ArrowRight");
    await chooseRowAsync(window, "Split down");
    await expect(documentGroups(window)).toHaveCount(2);
    await runCommandAsync(window, "Move the tab to the next group", "desktop.moveTabToNextGroup");
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([firstNote, secondNote]);
    await expect(documentGroups(window)).toHaveCount(1);
  });

  test("the focus commands move between the groups", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await splitFirstNoteAsync(window);
    await TabDragFixture.tab(window, secondNote).click();

    await runCommandAsync(window, "Focus the next group", "desktop.focusNextGroup");
    await expect(TabDragFixture.tab(window, secondNote)).not.toBeFocused();
    await expect(window.locator("nol-tab:focus")).toHaveCount(1);
    await runCommandAsync(window, "Focus the previous group", "desktop.focusPreviousGroup");
    await expect(TabDragFixture.tab(window, secondNote)).toBeFocused();
  });

  test("closing the last document of a group from the keyboard focuses a tab of the group that remains", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await splitFirstNoteAsync(window);
    await TabDragFixture.tab(window, firstNote).focus();

    await window.keyboard.press("ControlOrMeta+KeyW");

    await expect(documentGroups(window)).toHaveCount(1);
    await expect(TabDragFixture.tab(window, firstNote)).toHaveCount(0);
    await expect(TabDragFixture.tab(window, secondNote)).toBeFocused();
  });

  test("opening a document puts it in the active document group", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await splitFirstNoteAsync(window);
    await TabDragFixture.tab(window, firstNote).click();

    await window.locator(".nol-notes-list-item", { hasText: /^Meeting notes, week 1$/ }).click();
    await window.locator("nol-tab[data-tab-key='document/notes.note/week-1']").dblclick();

    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([firstNote, "document/notes.note/week-1"]);
    expect(await TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, secondNote))).toEqual([secondNote]);
  });

  test("a split's sash resizes the two document groups", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await splitFirstNoteAsync(window);
    const sash = window.getByRole("separator", { name: "Resize the pane on the left" });
    const left = TabDragFixture.groupOf(window, secondNote);
    const width = (await left.boundingBox())?.width ?? 0;
    const grip = await TabDragFixture.centerOfAsync(sash);

    await window.mouse.move(grip.x, grip.y);
    await window.mouse.down();
    await window.mouse.move(grip.x + 60, grip.y, { steps: 6 });
    await window.mouse.up();

    await expect.poll(async () => Math.round((await left.boundingBox())?.width ?? 0)).toBe(Math.round(width + 60));
    await mainProcess.checkpointAsync("document-split-resized");
  });

  test("the last document group stays and shows its empty card when its last document closes", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await TabDragFixture.tab(window, firstNote).click({ button: "right" });
    await window.getByRole("menuitem", { name: "Close all" }).click();

    await expect(window.locator("nol-tab[data-tab-key^='document/']")).toHaveCount(0);
    await expect(window.locator("nol-tab-group:not([data-side])")).toHaveCount(1);
    await expect(window.locator("nol-tab-group:not([data-side]) nol-tab")).toHaveCount(0);
    await mainProcess.checkpointAsync("document-last-group-empty");
  });

  for (const reopen of [true, false])
    test(`the arrangement and sizes return ${reopen ? "after reopening on the running runtime" : "after a restart that stops the runtime"}`, async ({ mainProcess }) => {
      const window = mainProcess.window;
      await splitFirstNoteAsync(window);
      const before = await window.locator("nol-tab-group").evaluateAll(groups => groups.map(group => [
        [...group.querySelectorAll("nol-tab")].map(t => t.getAttribute("data-tab-key")),
        group.getBoundingClientRect().toJSON()
      ]));

      await (reopen ? mainProcess.reopenAsync() : mainProcess.restartAsync());

      await expect(TabDragFixture.tab(mainProcess.window, firstNote)).toBeVisible();
      await expect.poll(() => mainProcess.window.locator("nol-tab-group").evaluateAll(groups => groups.map(group => [
        [...group.querySelectorAll("nol-tab")].map(t => t.getAttribute("data-tab-key")),
        group.getBoundingClientRect().toJSON()
      ]))).toEqual(before);
    });

  for (const reopen of [true, false])
    test(`each group's active tab returns ${reopen ? "after reopening on the running runtime" : "after a restart that stops the runtime"}`, async ({ mainProcess }) => {
      const window = mainProcess.window;
      const outline = "view/notes.outline";
      const clock = "view/clock.face";
      const tabOf = (key: string): Locator => TabDragFixture.tab(mainProcess.window, key);
      await TabDragFixture.dragOntoPlateAsync(window, clock, notes, "Center");
      await window.mouse.up();
      await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, notes))).toEqual([notes, outline, clock]);
      await tabOf(firstNote).click();
      await window.keyboard.press("ControlOrMeta+Alt+KeyN");
      await expect(tabOf(thirdNote)).toHaveAttribute("aria-selected", "true");
      await tabOf(firstNote).click();
      await tabOf(outline).click();
      await expect(tabOf(firstNote)).toHaveAttribute("aria-selected", "true");
      await expect(tabOf(outline)).toHaveAttribute("aria-selected", "true");

      await (reopen ? mainProcess.reopenAsync() : mainProcess.restartAsync());

      await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(mainProcess.window, firstNote))).toEqual([firstNote, secondNote, thirdNote]);
      await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(mainProcess.window, notes))).toEqual([notes, outline, clock]);
      await expect(tabOf(firstNote)).toHaveAttribute("aria-selected", "true");
      await expect(tabOf(outline)).toHaveAttribute("aria-selected", "true");
      await expect(tabOf(secondNote)).toHaveAttribute("aria-selected", "false");
      await expect(tabOf(clock)).toHaveAttribute("aria-selected", "false");
    });

  for (const reopen of [true, false])
    test(`a document closed before ${reopen ? "reopening on the running runtime" : "a restart that stops the runtime"} stays closed, though its module opens it at start`, async ({ mainProcess }) => {
      const window = mainProcess.window;
      const tabOf = (key: string): Locator => TabDragFixture.tab(mainProcess.window, key);
      await tabOf(firstNote).click();
      await window.keyboard.press("ControlOrMeta+Alt+KeyN");
      await expect(tabOf(thirdNote)).toHaveAttribute("aria-selected", "true");
      await tabOf(firstNote).click();
      await window.keyboard.press("ControlOrMeta+KeyW");
      await expect(tabOf(firstNote)).toHaveCount(0);
      await tabOf(secondNote).click();
      await expect(tabOf(secondNote)).toHaveAttribute("aria-selected", "true");

      await (reopen ? mainProcess.reopenAsync() : mainProcess.restartAsync());

      await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(mainProcess.window, secondNote))).toEqual([secondNote, thirdNote]);
      await expect(tabOf(secondNote)).toHaveAttribute("aria-selected", "true");
      await expect(tabOf(firstNote)).toHaveCount(0);
    });

  test("Reset the layout returns the documents to one group", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await splitFirstNoteAsync(window);
    await expect(documentGroups(window)).toHaveCount(2);

    await runCommandAsync(window, "Reset the layout", "desktop.resetLayout");

    await expect(documentGroups(window)).toHaveCount(1);
    await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, firstNote))).toEqual([secondNote, firstNote]);
  });
});
