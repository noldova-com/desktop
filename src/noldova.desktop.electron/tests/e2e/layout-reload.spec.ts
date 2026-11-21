/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test("a tab opened just before the window's page loads again is there after the reload, though the layout's save was still waiting on its pause", async ({ mainProcess }) => {
  const window = mainProcess.window;
  const opened = window.locator("nol-tab[data-tab-key=\"document/notes.note/3\"]");
  await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
  const origin = await window.evaluate(() => performance.timeOrigin);
  await window.keyboard.press("ControlOrMeta+Alt+N");
  await expect(opened).toBeVisible();

  await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.reload());
  await expect.poll(() => window.evaluate(() => performance.timeOrigin).catch(() => origin)).not.toBe(origin);

  await expect(opened).toBeVisible();
});
