/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test.describe("the status bar and the top bar", () => {
  test("the fixture modules' items take their sides, run their commands when clicked and follow their updates", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const count = window.locator(".nol-status-bar-left nol-status-bar-item[data-nol-item=\"notes.count\"]");
    const ticks = window.locator(".nol-status-bar-right nol-status-bar-item[data-nol-item=\"clock.ticks\"]");
    const compose = window.locator(".nol-window-row-actions button[data-nol-item=\"notes.compose\"]");
    await expect(count).toHaveText("2 notes");
    await expect(ticks).toHaveText(/No ticks/);
    await expect(compose).toBeEnabled();

    await ticks.getByRole("button").click();
    await expect(ticks).toHaveText(/Ticks: 1/);
    await compose.click();

    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/3\"] .nol-tab-label")).toHaveText("Note 3");
    await expect(count).toHaveText("3 notes");
    await expect(count.getByRole("button")).toHaveCount(0);
    await expect(compose).toHaveAttribute("aria-label", "New note");
    await expect(window.locator(".nol-status-bar-right > *")).toHaveCount(3);
    expect(await window.locator(".nol-status-bar-right > *").evaluateAll(t => t.map(u => u.getAttribute("data-nol-item") ?? u.tagName.toLowerCase())))
      .toEqual(["clock.ticks", "nol-notifications", "nol-module-failures"]);

    const look = await window.evaluate(() => {
      const style = (selector: string): CSSStyleDeclaration => {
        const element = document.querySelector(selector);
        if (element === null)
          throw new Error(`Nothing matches ${selector}.`);
        return getComputedStyle(element);
      };
      const pill = style("nol-status-bar-item[data-nol-item=\"clock.ticks\"] .nol-status-bar-item");
      const row = document.querySelector("nol-window-row");
      if (row === null)
        throw new Error("Nothing matches nol-window-row.");
      const lookHeight = (name: string): string => {
        const probe = document.createElement("div");
        probe.style.height = `var(--nol-${name})`;
        document.body.append(probe);
        const height = getComputedStyle(probe).height;
        probe.remove();
        return height;
      };
      const action = document.querySelector("button[data-nol-item=\"notes.compose\"]");
      if (action === null)
        throw new Error("Nothing matches button[data-nol-item=\"notes.compose\"].");
      return {
        pill: { height: style("nol-status-bar-item[data-nol-item=\"clock.ticks\"]").height, padding: [pill.paddingLeft, pill.paddingRight], radius: pill.borderTopLeftRadius },
        row: { height: getComputedStyle(row).height, look: lookHeight("window-row-height"), region: getComputedStyle(action).getPropertyValue("app-region") },
        isInRow: action.getBoundingClientRect().top >= row.getBoundingClientRect().top && action.getBoundingClientRect().bottom <= row.getBoundingClientRect().bottom
      };
    });
    expect(look).toEqual({ pill: { height: "20px", padding: ["6px", "6px"], radius: "3px" }, row: { height: look.row.look, look: look.row.look, region: "no-drag" }, isInRow: true });
    await mainProcess.checkpointAsync("bar-items");
  });

  test("a module that did not start shows no items, and the failures item stays at the status bar's right end", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("nol-status-bar-item[data-nol-item=\"clock.ticks\"]")).toHaveCount(1);
    const folder = path.join(mainProcess.dataDirectory, "modules", "clock");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "fail-activation"), String.empty);

    mainProcess.acceptRuntimeEnds();
    await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);

    await expect(window.locator("nol-module-failures button")).toBeVisible();
    await expect(window.locator("nol-status-bar-item[data-nol-item=\"clock.ticks\"]")).toHaveCount(0);
    await expect(window.locator("nol-status-bar-item[data-nol-item=\"notes.count\"]")).toHaveText("2 notes");
    expect(await window.locator(".nol-status-bar-right > *").evaluateAll(t => t.map(u => u.tagName.toLowerCase()))).toEqual(["nol-notifications", "nol-module-failures"]);
  });
});

test.describe("a status bar item cut short", () => {
  test.use({ mainProcessDataFiles: { "modules/notes/long-count": String.empty } });

  test("shows its full text in a tooltip on hover and keyboard focus, and is named by it", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const text = "2 notes, neither pinned nor archived, both last changed today by the person who wrote them, and both waiting for review";
    const item = window.locator("nol-status-bar-item[data-nol-item=\"notes.count\"]").getByRole("button");
    const tooltip = window.locator(".cdk-overlay-container nol-tooltip");
    await mainProcess.useViewportAsync(640, 480);
    await expect(item).toHaveAccessibleName(text);
    expect(await item.locator(".nol-status-bar-item-text").evaluate(t => t.scrollWidth > t.clientWidth)).toBe(true);

    await item.hover();
    await expect(tooltip).toHaveText(text);
    await window.mouse.move(320, 200);
    await expect(tooltip).toHaveCount(0);
    await item.focus();
    await window.keyboard.press("Tab");
    await window.keyboard.press("Shift+Tab");

    await expect(item).toBeFocused();
    await expect(tooltip).toHaveText(text);
    await mainProcess.checkpointAsync("status-bar-item-cut-short");
  });
});
