/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";

function shareAsync(window: Page): Promise<unknown> {
  return PageBridgeFixture.payloadAsync(window, "notes.sharePhoto", null);
}

function loadAsync(window: Page, address: string): Promise<unknown> {
  return window.evaluate(t => new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
    image.onerror = () => resolve("refused");
    image.src = t;
  }), address);
}

function loadInSessionsAsync(mainProcess: MainProcessFixture, address: string): Promise<unknown> {
  return mainProcess.application.evaluate(async ({ WebContentsView, session }, [shared, partition]) => {
    const results: unknown[] = [];
    for (const target of [session.defaultSession, session.fromPartition(partition)]) {
      const view = new WebContentsView({ webPreferences: { session: target, sandbox: true, contextIsolation: true } });
      try {
        await view.webContents.loadURL("data:text/html,<!doctype html><title>Check</title>");
        results.push(await view.webContents.executeJavaScript(`new Promise(resolve => { const image = new Image(); image.onload = () => resolve("loaded"); image.onerror = () => resolve("refused"); image.src = ${JSON.stringify(shared)}; })`));
      }
      finally {
        view.webContents.close();
      }
    }
    return results;
  }, [address, "persist:pages.main"] as const);
}

test.describe("shared files", () => {
  test("a module's runtime part shares an image its window's page loads by address, a web view's partition can't load it, and it ends when the page reloads", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();

    const grant = await shareAsync(window);
    expect(grant).toMatch(/^[0-9a-f]{32}$/);
    const address = `desktop-file://${String(grant)}/`;

    expect(await loadAsync(window, address)).toEqual([1, 1]);
    expect(await loadAsync(window, address)).toEqual([1, 1]);
    expect(await loadInSessionsAsync(mainProcess, address)).toEqual(["loaded", "refused"]);

    await window.reload();
    await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();

    expect(await loadAsync(window, address)).toBe("refused");
    expect(await loadInSessionsAsync(mainProcess, address)).toEqual(["refused", "refused"]);
    expect(mainProcess.acceptFailures(/A shared file was not served: NotFound\.|Failed to load resource/).length).toBeGreaterThan(0);
  });
});
