/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { TabContentFixture } from "./fixtures/tab-content.fixture.ts";

test.describe("links", () => {
  test("a link clicked or middle-clicked in a note and a link a window part opens reach the system's opener, and the window stays on its page", async ({ mainProcess }) => {
    await mainProcess.application.evaluate(({ shell }) => {
      const opened: string[] = [];
      globalThis.openedLinks = opened;
      shell.openExternal = (url: string): Promise<void> => {
        opened.push(url);
        return Promise.resolve();
      };
    });
    const window = mainProcess.window;
    const page = window.url();
    const note = await TabContentFixture.openAsync(window, "document/notes.note/1");
    const link = note.locator("[data-fixture-content=notes-link-1]");

    await link.click();
    await link.click({ button: "middle" });
    await window.locator("[data-fixture-content=notes-help-1]:visible").click();

    await expect.poll(() => mainProcess.application.evaluate(() => globalThis.openedLinks))
      .toEqual(["https://example.com/notes", "https://example.com/notes", "https://example.com/help"]);
    expect([window.url(), mainProcess.application.windows().length]).toEqual([page, 1]);
    await mainProcess.checkpointAsync("links-opened");
  });
});
