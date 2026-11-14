/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Page } from "@playwright/test";

import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";

const sessions: readonly [string, string][] = [["view/notes.session/7f3c9a2e-session-one", "Session one"], ["view/notes.session/b81d4e60-session-two", "Session two"]];
const documents: readonly [string, string][] = [["document/notes.note/1", "Note 1"], ["document/notes.note/2", "Note 2"], ["document/notes.note/3", "Note 3"]];

test.use({ mainProcessDataFiles: { "modules/notes/sessions": String.empty } });

function readTitlesAsync(window: Page): Promise<string[]> {
  return window.locator("nol-tab[data-tab-key]").evaluateAll(t => t.map(u => `${u.getAttribute("data-tab-key")}: ${u.getAttribute("aria-label") ?? u.textContent?.trim() ?? ""}`));
}

async function expectTitledAsync(window: Page): Promise<void> {
  for (const [key, title] of [...sessions, ...documents])
    await expect(window.locator(`nol-tab[data-tab-key="${key}"]`), await readTitlesAsync(window).then(t => t.join("\n"))).toContainText(title);
  const [shown, shownTitle] = documents[0] ?? [String.empty, String.empty];
  await window.locator(`nol-tab[data-tab-key="${shown}"]`).click();
  await expect.poll(() => window.evaluate(() => document.title.split(" — ")[0] ?? "")).toBe(shownTitle);
}

async function moveIntoDocumentsAsync(window: Page): Promise<void> {
  const [key] = sessions[1] ?? [String.empty];
  const from = await window.locator(`nol-tab[data-tab-key="${key}"]`).boundingBox();
  const to = await window.locator(`nol-tab[data-tab-key="${documents[1]?.[0]}"]`).boundingBox();
  if (Object.isNull(from) || Object.isNull(to))
    throw new Error("A tab to move has no box.");
  await window.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await window.mouse.down();
  await window.mouse.move(to.x + to.width - 4, to.y + to.height / 2, { steps: 12 });
  await window.mouse.up();
  await expect(window.locator("nol-tab-group", { has: window.locator(`nol-tab[data-tab-key="${documents[0]?.[0]}"]`) }).locator(`nol-tab[data-tab-key="${key}"]`)).toHaveCount(1);
}

test.describe("the titles of tabs a module opened", () => {
  test.beforeEach(async ({ mainProcess }) => {
    await expect(mainProcess.window.locator(`nol-tab[data-tab-key="${documents[0]?.[0]}"]`)).toBeVisible();
    await mainProcess.window.keyboard.press("ControlOrMeta+Alt+N");
    await expect(mainProcess.window.locator(`nol-tab[data-tab-key="${documents[2]?.[0]}"]`)).toBeVisible();
    await moveIntoDocumentsAsync(mainProcess.window);
    await expectTitledAsync(mainProcess.window);
  });

  test("stay through minimizing and restoring the window", async ({ mainProcess }) => {
    test.skip(process.platform === "linux", "The end-to-end runs on Linux use a display server with no window manager, which can't minimize a window.");
    await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.minimize());
    await expect.poll(() => mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized())).toBe(true);
    await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.restore());
    await expect.poll(() => mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMinimized())).toBe(false);
    await mainProcess.window.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    test.info().annotations.push({
      type: "limit",
      description: "A minimized window's page stays visible at its full size in this harness, so this case checks the titles a frame after the restore, not what a hidden page does."
    });

    await expectTitledAsync(mainProcess.window);
  });

  test("stay after the window's page loads again", async ({ mainProcess }) => {
    const origin = await mainProcess.window.evaluate(() => performance.timeOrigin);
    await expect.poll(async () => JSON.stringify(await PageBridgeFixture.evaluateAsync(mainProcess.window, t => t.readLayout()))).toContain(JSON.stringify({ document: "notes.note", instance: "3" }));

    await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.reload());
    await expect.poll(() => mainProcess.window.evaluate(() => performance.timeOrigin).catch(() => origin)).not.toBe(origin);

    await expectTitledAsync(mainProcess.window);
  });

  test("stay after the runtime starts again", async ({ mainProcess }) => {
    const processId = await mainProcess.readRuntimeProcessIdAsync();
    expect(processId).toBeDefined();
    await mainProcess.window.evaluate(() => {
      const record = { wasInert: false };
      const workspace = document.querySelector("nol-workspace");
      new MutationObserver(() => {
        record.wasInert ||= workspace?.hasAttribute("inert") === true;
      }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["inert"] });
      globalThis.titlesReconnecting = record;
    });

    mainProcess.acceptRuntimeEnds();
    await MainProcessFixture.stopRuntimeAsync(mainProcess.dataDirectory);
    await expect.poll(() => mainProcess.window.evaluate(() => globalThis.titlesReconnecting?.wasInert)).toBe(true);
    await expect.poll(async () => {
      const restarted = await mainProcess.readRuntimeProcessIdAsync();
      return !Object.isUndefined(restarted) && restarted !== processId;
    }).toBe(true);
    await expect(mainProcess.window.locator(".nol-window-reconnecting")).toHaveCount(0);
    await expect(mainProcess.window.locator("nol-workspace")).not.toHaveAttribute("inert");

    await expectTitledAsync(mainProcess.window);
  });

  test("stay after the app starts again with its tabs restored", async ({ mainProcess }) => {
    await mainProcess.reopenAsync();
    await expectTitledAsync(mainProcess.window);

    await mainProcess.restartAsync();
    await expectTitledAsync(mainProcess.window);
  });
});
