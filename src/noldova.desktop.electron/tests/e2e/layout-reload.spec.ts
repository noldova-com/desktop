/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";

const OPENED_KEY: string = "document/notes.note/3";

test("a tab opened just before the window's page loads again is there after the reload, though the layout's save was still waiting on its pause", async ({ mainProcess }) => {
  const window = mainProcess.window;
  const opened = window.locator(`nol-tab[data-tab-key="${OPENED_KEY}"]`);
  await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]")).toBeVisible();
  const origin = await window.evaluate(() => performance.timeOrigin);
  await window.evaluate(key => {
    const reloadOnceShown = new MutationObserver(() => {
      if (document.querySelector(`nol-tab[data-tab-key="${key}"]`) === null)
        return;
      reloadOnceShown.disconnect();
      location.reload();
    });
    reloadOnceShown.observe(document.body, { childList: true, subtree: true });
  }, OPENED_KEY);

  await window.keyboard.press("ControlOrMeta+Alt+N");
  await expect.poll(() => window.evaluate(() => performance.timeOrigin).catch(() => origin)).not.toBe(origin);

  await expect(opened).toBeVisible();
});
