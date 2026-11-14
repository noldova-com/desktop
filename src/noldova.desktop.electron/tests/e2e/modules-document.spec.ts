/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import type { Locator, Page } from "@playwright/test";

import { RuntimeBuild } from "@noldova/desktop.runtime";

import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import { CliFixture } from "./fixtures/cli.fixture.ts";
import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import { ContrastFixture } from "./fixtures/contrast.fixture.ts";
import { InkFixture } from "./fixtures/ink.fixture.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

const colors = {
  Light: { link: "rgb(0, 95, 184)", error: "rgb(161, 38, 13)", selected: ContrastFixture.SELECTED_ROW_BACKGROUND.light, text: "rgb(59, 59, 59)" },
  Dark: { link: "rgb(77, 170, 252)", error: "rgb(244, 135, 113)", selected: ContrastFixture.SELECTED_ROW_BACKGROUND.dark, text: "rgb(189, 189, 189)" }
};

function modulesTab(window: Page): Locator {
  return window.locator("nol-tab[data-tab-key=\"document/desktop.modules\"]");
}

function row(window: Page, id: string): Locator {
  return window.locator(`.nol-modules-row[data-module="${id}"]`);
}

function fact(window: Page, name: string): Locator {
  return window.locator(`.nol-modules-fact-${name}`);
}

async function openFromCommandSearchAsync(window: Page): Promise<void> {
  await CommandSearchFixture.searchAsync(window, "Modules");
  await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/desktop.openModules");
  await window.keyboard.press("Enter");
  await expect(window.locator("nol-modules")).toBeVisible();
}

async function startProgramAsync(dataDirectory: string, ...commandArguments: string[]): Promise<number[]> {
  const started = JsonReader.parse(await CliFixture.runAsync("run", "clock.startProgram", ...commandArguments, "--json", "--data-dir", dataDirectory));
  return [started.readInteger("processId"), started.readInteger("childProcessId")];
}

async function setModeAsync(window: Page, mode: string): Promise<void> {
  await PageBridgeFixture.evaluateAsync(window, (t, value) => t.request("desktop.setSetting", { name: "desktop.mode", value }), mode);
}

test.describe("the Modules document", () => {
  test("opens from command search as one document, lists the modules in module order and shows a module's details, in light and dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();

    await openFromCommandSearchAsync(window);
    await openFromCommandSearchAsync(window);

    await expect(modulesTab(window)).toHaveCount(1);
    await expect(modulesTab(window)).toHaveAttribute("aria-selected", "true");
    await expect(modulesTab(window).locator(".nol-tab-label")).toHaveText("Modules");
    await expect(window.locator(".nol-modules-version")).toHaveText(`Noldova Desktop Sample ${RuntimeBuild.identity.productVersion}`);
    await expect(window.locator(".nol-modules-row .nol-modules-name")).toHaveText(["Clock", "Notes", "Pages", "Reminder", "Alarm", "Beacon"]);
    await expect(window.locator(".nol-modules-row .nol-modules-id")).toHaveText(["clock", "notes", "pages", "reminder", "alarm", "beacon"]);
    await expect(window.locator(".nol-modules-row .nol-modules-row-version")).toHaveText(["0.0.1", "0.0.1", "0.0.1", "0.0.1", "0.0.1", "0.0.1"]);
    await expect(window.locator(".nol-modules-row .nol-modules-state")).toHaveText(["Active", "Active", "Active", "Active", "Active", "Active"]);
    await expect(row(window, "alarm").locator(".nol-modules-description")).toHaveText("Depends on the clock, so it is blocked whenever the clock fails, for the UI workflows.");
    await expect(row(window, "clock")).toHaveAttribute("aria-current", "true");
    await expect(window.locator(".nol-modules-detail-title")).toHaveText("Clock");
    await expect(fact(window, "version")).toHaveText("0.0.1");
    await expect(fact(window, "dependencies")).toHaveText("None");
    await expect(fact(window, "dependents")).toHaveText("Alarm");
    await expect(window.locator(".nol-modules-group")).toHaveCount(4);
    await expect(window.locator(".nol-modules-contributions")).toHaveCount(0);
    await window.locator(".nol-modules-group[data-kind=commands] button").click();
    await window.locator(".nol-modules-group[data-kind=settings] button").click();
    await expect(window.locator(".nol-modules-contributions[data-kind=commands]")).toContainText("clock.tick");
    await expect(window.locator(".nol-modules-contributions[data-kind=settings]")).toContainText("clock.tickStep");

    await fact(window, "dependents").getByRole("button", { name: "Alarm" }).click();

    await expect(row(window, "alarm")).toBeFocused();
    await expect(row(window, "alarm")).toHaveAttribute("aria-current", "true");
    await expect(fact(window, "dependencies")).toHaveText("Clock");
    await expect(window.locator(".nol-modules-none").last()).toHaveText("No commands, settings, menus, views or notification kinds.");

    await row(window, "clock").click();
    await WindowModeFixture.expectStrongTextAsync(window, window.locator(".nol-modules-detail-title"), window.locator(".nol-modules-section-title").first());
    for (const mode of ["Light", "Dark"] as const) {
      await setModeAsync(window, mode);
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(mode.toLowerCase());
      const lowest = await ContrastFixture.measureLowestTextContrastAsync(row(window, "clock"), colors[mode].selected);
      const look = await window.evaluate(() => {
        const style = (selector: string): CSSStyleDeclaration => {
          const element = document.querySelector(selector);
          if (element === null)
            throw new Error(`Nothing matches ${selector}.`);
          return getComputedStyle(element);
        };
        const top = (selector: string): number => {
          const element = document.querySelector(selector);
          if (element === null)
            throw new Error(`Nothing matches ${selector}.`);
          return element.getBoundingClientRect().top;
        };
        const version = ".nol-modules-row-current .nol-modules-row-version";
        return [style(".nol-modules-link").color, style(".nol-modules-row-current").backgroundColor, style(version).color, top(version) === top(".nol-modules-row-current .nol-modules-id")];
      });
      expect(look).toEqual([colors[mode].link, colors[mode].selected, colors[mode].text, true]);
      expect(lowest).toBeGreaterThanOrEqual(ContrastFixture.MINIMUM_TEXT_CONTRAST);
      const next = window.locator(".nol-modules-row-current + .nol-modules-row");
      await next.hover();
      expect(await next.evaluate(t => (t.getBoundingClientRect().top - (t.previousElementSibling?.getBoundingClientRect().bottom ?? Number.NaN))
        / Number.parseFloat(getComputedStyle(document.documentElement).fontSize))).toBeCloseTo(0.25, 1);
      await mainProcess.checkpointAsync(`modules-document-${mode.toLowerCase()}`);
    }
  });

  test("lists a module's running programs while they run, with their count in its row, in light and dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await openFromCommandSearchAsync(window);
    await expect(window.locator(".nol-modules-section-title")).toHaveText(["Running programs", "Contributes"]);
    await expect(window.locator(".nol-modules-detail").getByText("No programs are running.")).toBeVisible();
    const executable = await readFile(path.resolve("_build", "development-app", "path.txt"), "utf8");

    const running = await startProgramAsync(mainProcess.dataDirectory);
    const program = window.locator(`.nol-modules-program[data-process="${running[0]}"]`);

    await expect(program.locator(".nol-modules-program-name")).toHaveText(path.basename(executable));
    await expect(program.locator(".nol-modules-program-state")).toHaveText("Less than a minute");
    await program.locator(".nol-modules-program-name").hover();
    await expect(window.locator(".cdk-overlay-container nol-tooltip")).toContainText(`${executable} · Process ${running[0]}, started `);
    await window.mouse.move(1, 1);
    await program.getByRole("button", { name: "Copy path" }).click();
    await expect(program.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await mainProcess.application.evaluate(({ clipboard }) => clipboard.readText())).toBe(executable);
    await expect(row(window, "clock").locator(".nol-modules-row-programs")).toHaveText("1 program");
    await expect(window.locator(".nol-modules-row-programs")).toHaveCount(1);
    for (const mode of ["Light", "Dark"] as const) {
      await setModeAsync(window, mode);
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(mode.toLowerCase());
      const lowest = await ContrastFixture.measureLowestTextContrastAsync(row(window, "clock"), colors[mode].selected);
      expect(lowest).toBeGreaterThanOrEqual(ContrastFixture.MINIMUM_TEXT_CONTRAST);
      await mainProcess.checkpointAsync(`modules-document-program-${mode.toLowerCase()}`);
    }

    const exited = process.platform === "win32" ? [] : await startProgramAsync(mainProcess.dataDirectory, "\"exit\"");
    if (process.platform !== "win32") {
      const kept = window.locator(`.nol-modules-program[data-process="${exited[0]}"]`);
      await expect(kept.locator(".nol-modules-program-state")).toHaveText("Exited, its processes still run");
      await expect(row(window, "clock").locator(".nol-modules-row-programs")).toHaveText("2 programs");
      await mainProcess.checkpointAsync("modules-document-program-exited");
    }

    await CliFixture.runAsync("run", "clock.stopProgram", "--data-dir", mainProcess.dataDirectory);

    await expect(program).toHaveCount(0);
    await expect.poll(() => running.filter(t => MainProcessFixture.isAlive(t))).toEqual([]);
    await expect(window.locator(".nol-modules-program")).toHaveCount(exited.length > 0 ? 1 : 0);
    await expect(window.locator(".nol-modules-row-programs")).toHaveText(exited.length > 0 ? ["1 program"] : []);
  });

  test("shows a running program on one line with its running time at the end, a module's description on one line and each kind of contribution closed with its count, lined up with the programs, with 2rem above each section, in light, dark and forced colors", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await openFromCommandSearchAsync(window);
    const running = await startProgramAsync(mainProcess.dataDirectory);
    await expect(window.locator(`.nol-modules-program[data-process="${running[0]}"]`)).toBeVisible();

    for (const look of ["Light", "Dark", "Forced"] as const) {
      if (look === "Forced")
        await MediaFixture.emulateAsync(window, { forcedColors: "active" });
      else {
        await setModeAsync(window, look);
        await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(look.toLowerCase());
      }
      const measured = await window.evaluate(() => {
        const box = (selector: string): DOMRect => {
          const element = document.querySelector(selector);
          if (element === null)
            throw new Error(`Nothing matches ${selector}.`);
          return element.getBoundingClientRect();
        };
        const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
        const line = box(".nol-modules-program");
        const name = box(".nol-modules-program-name");
        const state = box(".nol-modules-program-state");
        const copy = box(".nol-modules-program-copy");
        const middle = (t: DOMRect): number => t.top + t.height / 2;
        const description = document.querySelector<HTMLElement>(".nol-modules-row[data-module=alarm] .nol-modules-description");
        if (description === null)
          throw new Error("Nothing matches .nol-modules-row[data-module=alarm] .nol-modules-description.");
        const glyph = document.querySelector(".nol-modules-program-copy .nol-icon-button-glyph");
        if (glyph === null)
          throw new Error("Nothing matches .nol-modules-program-copy .nol-icon-button-glyph.");
        const sections = [...document.querySelectorAll(".nol-modules-section-title")].map(t => Number.parseFloat(getComputedStyle(t).marginTop) / rem);
        const probe = document.body.appendChild(document.createElement("span"));
        probe.style.color = "ButtonText";
        const buttonText = getComputedStyle(probe).color;
        probe.remove();
        return {
          programLine: Math.abs(line.height - copy.height) < 1 && Math.abs(middle(name) - middle(copy)) < 1 && Math.abs(middle(state) - middle(copy)) < 1,
          programOrder: name.right <= state.left && state.right <= copy.left && Math.abs(copy.right - line.right) < 1,
          stateAtEnd: state.left - name.right > rem && Math.abs(copy.left - state.right - rem / 2) < 1,
          lineLeft: line.left,
          descriptionLines: Math.round(description.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(description).lineHeight)),
          descriptionCut: description.scrollWidth > description.clientWidth,
          groups: [...document.querySelectorAll(".nol-modules-group button")].map(t => [t.getAttribute("aria-expanded"), t.querySelector(".nol-group-header-count")?.textContent?.trim()]),
          lists: document.querySelectorAll(".nol-modules-contributions").length,
          sections,
          copyGlyph: getComputedStyle(glyph).color,
          buttonText
        };
      });

      const inks = await InkFixture.startsAsync(window, window.locator(".nol-modules-group button"), ".nol-group-header-title");

      expect(inks.map(t => Math.abs(t - measured.lineLeft) < 1.5)).toEqual([true, true, true, true]);
      expect(measured).toMatchObject({ programLine: true, programOrder: true, stateAtEnd: true, descriptionLines: 1, descriptionCut: true, lists: 0, sections: [2, 2] });
      expect(measured.groups.map(t => t[0])).toEqual(["false", "false", "false", "false"]);
      expect(measured.groups.every(t => Number(t[1]) > 0)).toBe(true);
      if (look === "Forced")
        expect(measured.copyGlyph).toBe(measured.buttonText);
      await mainProcess.checkpointAsync(`modules-document-dense-${look.toLowerCase()}`);
    }

    await CliFixture.runAsync("run", "clock.stopProgram", "--data-dir", mainProcess.dataDirectory);
    await expect.poll(() => running.filter(t => MainProcessFixture.isAlive(t))).toEqual([]);
  });

  test("lines each group's twistie ink up with the programs at a page zoom of 2, two device pixels per CSS pixel", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await openFromCommandSearchAsync(window);
    const running = await startProgramAsync(mainProcess.dataDirectory);
    await expect(window.locator(`.nol-modules-program[data-process="${running[0]}"]`)).toBeVisible();
    await mainProcess.zoomAsync(2, 960);

    const [ratio, lineLeft] = await window.evaluate(() => {
      const line = document.querySelector(".nol-modules-program");
      if (line === null)
        throw new Error("Nothing matches .nol-modules-program.");
      return [devicePixelRatio, line.getBoundingClientRect().left];
    });
    const inks = await InkFixture.startsAsync(window, window.locator(".nol-modules-group button"), ".nol-group-header-title");
    await mainProcess.zoomAsync(1, 1920);

    expect([MainProcessFixture.roundPixelRatio(ratio), inks.map(t => Math.abs(t - lineLeft) < 1.5)]).toEqual([2, [true, true, true, true]]);
    await CliFixture.runAsync("run", "clock.stopProgram", "--data-dir", mainProcess.dataDirectory);
    await expect.poll(() => running.filter(t => MainProcessFixture.isAlive(t))).toEqual([]);
  });

  test("follows a module that stops starting while open, showing its cause and the module it blocks", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await openFromCommandSearchAsync(window);
    await row(window, "alarm").click();
    await expect(row(window, "alarm")).toBeFocused();

    const folder = path.join(mainProcess.dataDirectory, "modules", "clock");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "fail-activation"), String.empty);
    mainProcess.acceptRuntimeEnds();
    await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);

    await expect(window.locator(".nol-modules-row .nol-modules-state")).toHaveText([/Failed/, "Active", "Active", "Active", /Blocked/, "Active"]);
    await expect(row(window, "alarm")).toHaveAttribute("aria-current", "true");
    await expect(window.locator(".nol-modules-detail-title")).toHaveText("Alarm");
    await expect(fact(window, "state")).toHaveText(/Blocked\s*It depends on clock, which is not active\./);
    await expect(fact(window, "blocker")).toHaveText("Clock");
    const icon = await row(window, "alarm").locator(".nol-modules-state-icon").evaluate(t => [t.textContent, getComputedStyle(t).color]);
    const isDark = await window.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
    expect(icon).toEqual(["error", (isDark ? colors.Dark : colors.Light).error]);
    const heads = await window.locator(".nol-modules-row-head").evaluateAll(t => t.map(u => u.getBoundingClientRect().height));
    expect(Math.max(...heads) - Math.min(...heads)).toBeLessThanOrEqual(1);
    const [label = 0, cause = 0] = await fact(window, "state").evaluate(t => [".nol-modules-state-label", ".nol-modules-cause"].map(u => {
      const part = t.querySelector(u);
      if (part === null)
        throw new Error(`Nothing matches ${u}.`);
      return part.getBoundingClientRect().bottom;
    }));
    expect(Math.abs(label - cause)).toBeLessThanOrEqual(1);

    await fact(window, "blocker").getByRole("button", { name: "Clock" }).click();

    await expect(row(window, "clock")).toBeFocused();
    await expect(fact(window, "state")).toHaveText(/Failed\s*Its runtime part failed to activate\./);
    await expect(fact(window, "dependents")).toHaveText("Alarm");
    await mainProcess.checkpointAsync("modules-document-failed");
  });

  test("blocks a module from a package when its dependency is at another version, naming the dependency, the version it needs and the app's", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await openFromCommandSearchAsync(window);
    await expect(row(window, "beacon").locator(".nol-modules-state")).toHaveText("Active");

    await BuildVariantFixture.changeDeclarationsAsync(t => t.replace(/("id": "reminder",\s*"version": )"0\.0\.1"/, "$1\"0.1.0\""));
    mainProcess.acceptRuntimeEnds();
    await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);

    await expect(window.locator(".nol-modules-row .nol-modules-state")).toHaveText(["Active", "Active", "Active", "Active", "Active", /Blocked/]);
    await expect(row(window, "reminder").locator(".nol-modules-row-version")).toHaveText("0.1.0");
    await row(window, "beacon").click();
    await expect(window.locator(".nol-modules-detail-title")).toHaveText("Beacon");
    await expect(fact(window, "state")).toHaveText(/Blocked\s*It depends on reminder 0\.0\.1, and the app has reminder 0\.1\.0\./);
    await expect(fact(window, "blocker")).toHaveText("Reminder");
  });
});

test.describe("the Modules document from the View menu on Windows and Linux", () => {
  test.skip(process.platform === "darwin", "macOS shows the menus in its own menu bar.");

  test("Modules… in the View menu opens the document", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await window.locator("nol-menu-bar").getByRole("menuitem", { name: "View" }).click();
    await window.locator(".cdk-overlay-container nol-menu.nol-place-menu").last().getByRole("menuitem", { name: "Modules…" }).click();

    await expect(window.locator("nol-modules")).toBeVisible();
    await expect(modulesTab(window)).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("the Modules document from the View menu on macOS", () => {
  test.skip(process.platform !== "darwin", "Windows and Linux show the menus in the window row.");

  test("Modules… in the application's View menu opens the document", async ({ mainProcess }) => {
    const item = (): Promise<readonly [string, boolean] | null> => mainProcess.application.evaluate(({ Menu }) => {
      const found = Menu.getApplicationMenu()?.getMenuItemById("desktop.view/desktop.modules/0");
      return found ? [found.label, found.enabled] as const : null;
    });

    await expect.poll(item).toEqual(["Modules…", true]);
    await mainProcess.application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.getMenuItemById("desktop.view/desktop.modules/0")?.click());

    await expect(mainProcess.window.locator("nol-modules")).toBeVisible();
    await expect(modulesTab(mainProcess.window)).toHaveAttribute("aria-selected", "true");
  });
});
