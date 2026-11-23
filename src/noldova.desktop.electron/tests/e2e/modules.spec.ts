/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { ProductInfo } from "@noldova/desktop.runtime";

import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";

const colors = {
  light: { error: "rgb(161, 38, 13)", raised: "rgb(248, 248, 248)", cardBorder: "rgb(229, 229, 229)" },
  dark: { error: "rgb(244, 135, 113)", raised: "rgb(43, 43, 43)", cardBorder: "rgb(37, 37, 37)" }
};

const tab = (mainProcess: MainProcessFixture, key: string): ReturnType<MainProcessFixture["window"]["locator"]> =>
  mainProcess.window.locator(`nol-tab[data-tab-key="${key}"]`);

const readKeptLayoutAsync = async (mainProcess: MainProcessFixture): Promise<string> =>
  JSON.stringify(await PageBridgeFixture.evaluateAsync(mainProcess.window, t => t.readLayout()));

const failClockAsync = async (mainProcess: MainProcessFixture): Promise<void> => {
  const folder = path.join(mainProcess.dataDirectory, "modules", "clock");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "fail-activation"), String.empty);
  mainProcess.acceptRuntimeEnds();
  await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);
  await expect(mainProcess.window.locator("nol-module-failures button")).toBeVisible();
};

test.describe("modules", () => {
  test("the fixture modules' views and documents take their places and show their content @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await expect(window.locator("nol-tab-group[data-side=Left] .nol-tab-label")).toHaveText(["Notes", "Outline"]);
    await expect(window.locator("nol-tab-group[data-side=Right] .nol-tab-label")).toHaveText(["Clock"]);
    await expect(tab(mainProcess, "document/notes.note/1").locator(".nol-tab-label")).toHaveText("Note 1");
    await expect(tab(mainProcess, "document/notes.note/2").locator(".nol-tab-label")).toHaveText("Note 2");
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
    await expect(window.locator("[data-fixture-content=notes-note-2]")).toHaveText("Note 2");
    await expect(window.locator("nol-empty-window")).toHaveCount(0);
    await expect(window.locator("nol-module-failures button")).toHaveCount(0);

    await tab(mainProcess, "view/notes.outline").click();
    await tab(mainProcess, "document/notes.note/1").click();

    await expect(window.locator("[data-fixture-content=notes-outline]")).toBeVisible();
    await expect(window.locator("[data-fixture-content=notes-note-1]")).toHaveText("Note 1");
    await mainProcess.checkpointAsync("modules");
  });

  test("a window part that fails to activate writes the failure and its cause to the main process's log under its module's id", async ({ mainProcess }) => {
    await mainProcess.window.evaluate(() => localStorage.setItem("noldova-desktop.fixture.clock.failWindowPart", "true"));
    await mainProcess.reopenAsync();
    const log = (): Promise<string> => readFile(path.join(mainProcess.dataDirectory, "logs", "main.log"), "utf8");

    await expect(mainProcess.window.locator("nol-module-failures button")).toHaveText(/1 module didn't start/);
    await expect.poll(log).toMatch(/Window error in clock: WindowPartActivationFailedException: Its window part failed to activate\.\n/);
    expect(await log()).toMatch(/Window error in clock: Caused by: Error: The clock's window part was asked to fail\./);
    expect(mainProcess.acceptFailures(/Window error in clock: |failed to activate|asked to fail/).length).toBeGreaterThan(0);
  });

  test("the clock's window part asks its runtime part for the time", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("[data-fixture-content=clock-face]")).toHaveText(/^The runtime's time is \d{4}-\d\d-\d\dT/);
  });

  test("a module that didn't start keeps its view's place, says why in the status bar and its view, and offers its details", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("[data-fixture-content=clock-face]")).toBeVisible();

    await tab(mainProcess, "view/notes.outline").click();
    await failClockAsync(mainProcess);
    const window = mainProcess.window;
    const item = window.locator("nol-module-failures button.nol-module-failures-item");
    await expect.poll(() => readKeptLayoutAsync(mainProcess)).toContain(JSON.stringify({ tabs: [{ view: "notes.list" }, { view: "notes.outline" }], active: 1, recent: [1, 0] }));

    await expect(item).toHaveText(/error\s*2 modules didn't start/);
    await expect(window.locator("nol-tab-group[data-side=Right] .nol-tab-label")).toHaveText(["Clock"]);
    await expect(tab(mainProcess, "view/clock.face").locator(".nol-tab-icon")).toHaveText("error");
    await expect(window.locator("nol-module-failure-card")).toHaveText(/Clock didn't start\s*Its runtime part failed to activate\./);
    await expect(window.locator("nol-tab-group[data-side=Left] .nol-tab-label")).toHaveText(["Notes", "Outline"]);

    const look = await window.evaluate(() => {
      const style = (selector: string): CSSStyleDeclaration => {
        const element = document.querySelector(selector);
        if (element === null)
          throw new Error(`Nothing matches ${selector}.`);
        return getComputedStyle(element);
      };
      const item = style(".nol-module-failures-item");
      const card = style(".nol-module-failure-card");
      const failures = document.querySelector("nol-module-failures");
      if (failures === null)
        throw new Error("Nothing matches nol-module-failures.");
      return {
        isDark: matchMedia("(prefers-color-scheme: dark)").matches,
        item: { height: item.height, padding: [item.paddingLeft, item.paddingRight], radius: item.borderTopLeftRadius, background: item.backgroundColor, color: item.color, isRight: failures.closest(".nol-status-bar-right") !== null },
        icon: { color: style(".nol-module-failures-icon").color, size: style(".nol-module-failures-icon").fontSize },
        card: { border: card.borderTopWidth, borderColor: card.borderTopColor, radius: card.borderTopLeftRadius, background: card.backgroundColor, padding: card.paddingTop },
        cardIcon: style(".nol-module-failure-card-icon").color,
        barColor: style("nol-status-bar").color
      };
    });
    const palette = look.isDark ? colors.dark : colors.light;
    expect(look.item).toEqual({ height: "20px", padding: ["6px", "6px"], radius: "3px", background: "rgba(0, 0, 0, 0)", color: look.barColor, isRight: true });
    expect(look.icon).toEqual({ color: palette.error, size: "16px" });
    expect(look.card).toEqual({ border: "1px", borderColor: palette.cardBorder, radius: "6px", background: palette.raised, padding: "12px" });
    expect(look.cardIcon).toBe(palette.error);

    await item.click();
    const detail = window.locator("nol-modules .nol-modules-detail");
    await expect(window.locator("nol-modules")).toBeVisible();
    await expect(window.locator("nol-modules [aria-current=true]")).toHaveAttribute("data-module", "clock");
    await expect(detail.locator(".nol-modules-detail-title")).toHaveText("Clock");
    await expect(detail.locator(".nol-modules-fact-state")).toHaveText(/Failed\s*Its runtime part failed to activate\./);
    await mainProcess.checkpointAsync("module-failures");

    const product = ProductInfo.read(ProductInfo.file);
    await detail.getByRole("button", { name: "Copy details" }).click();
    await expect(detail.getByRole("button", { name: "Copied" })).toBeVisible();
    const inHome = path.relative(realpathSync.native(os.homedir()), realpathSync.native(mainProcess.dataDirectory));
    const isInHome = !inHome.startsWith("..") && !path.isAbsolute(inHome);
    const ownPart = path.sep + path.join(path.basename(path.dirname(mainProcess.dataDirectory)), path.basename(mainProcess.dataDirectory));
    const [build, folderLine, platform, failure] = (await mainProcess.application.evaluate(({ clipboard }) => clipboard.readText())).split("\n");
    const folder = folderLine?.replace(/^Data folder: /, String.empty) ?? String.empty;
    expect([build, isInHome ? folder : folder.slice(-ownPart.length), platform, failure]).toEqual([
      `Noldova Desktop Sample ${product.version}, build ${product.build}`, isInHome ? path.join("~", inHome) : ownPart, `Platform: ${process.platform} ${process.arch}`, "clock 0.0.1: Failed: Its runtime part failed to activate."]);

    await mainProcess.application.evaluate(({ shell }) => {
      shell.openPath = (folder: string): Promise<string> => Promise.resolve(folder.endsWith("logs") ? "" : "unexpected folder");
    });
    await detail.getByRole("button", { name: "Open log folder" }).click();
    await expect.poll(() => existsSync(path.join(mainProcess.dataDirectory, "logs"))).toBe(true);
    await expect(detail.getByRole("status")).toHaveCount(0);

    await window.locator("nol-modules .nol-modules-row[data-module=notes]").click();
    await expect(detail.getByRole("button", { name: "Copy details" })).toHaveCount(0);
  });

  test("a module that didn't start when the runtime started again keeps the place it was moved to", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    await tab(mainProcess, "view/clock.face").dragTo(mainProcess.window.locator("nol-tab-group[data-side=Left] .nol-tab-group-strip"));
    await expect(mainProcess.window.locator("nol-tab-group[data-side=Left] .nol-tab-label")).toHaveText(["Notes", "Outline", "Clock"]);

    await failClockAsync(mainProcess);

    await expect(mainProcess.window.locator("nol-tab-group[data-side=Left] .nol-tab-label")).toHaveText(["Notes", "Outline", "Clock"]);
    await expect(mainProcess.window.locator("nol-tab-group[data-side=Right]")).toHaveCount(0);
    await tab(mainProcess, "view/clock.face").click();
    await expect(mainProcess.window.locator("nol-module-failure-card")).toHaveText(/Clock didn't start/);
  });
});
