/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import "@noldova/context.core";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test.describe("bluetooth", () => {
  test("no page can ask for a Bluetooth device, the window's own page or one in a window opened later, and every device choice is cancelled", async ({ mainProcess }) => {
    const windowPage = await mainProcess.window.evaluate(() => "bluetooth" in navigator);
    const laterPage = await mainProcess.application.evaluate(async ({ BrowserWindow }) => {
      const later = new BrowserWindow({ show: false });
      await later.loadURL("about:blank");
      const found = await later.webContents.executeJavaScript("\"bluetooth\" in navigator") as boolean;
      later.destroy();
      return found;
    });
    const choices = await mainProcess.application.evaluate(async ({ BrowserWindow, webContents }) => {
      const later = new BrowserWindow({ show: false });
      await later.loadURL("about:blank");
      const results = webContents.getAllWebContents().map(contents => {
        const chosen: string[] = [];
        let isPrevented = false;
        contents.emit("select-bluetooth-device", { preventDefault: () => { isPrevented = true; } }, [{ deviceId: "AA:BB", deviceName: "Headphones" }], (deviceId: string) => chosen.push(deviceId));
        return { isPrevented, chosen };
      });
      later.destroy();
      return results;
    });

    expect([windowPage, laterPage]).toEqual([false, false]);
    expect(choices.length).toBeGreaterThan(1);
    expect(choices.filter(t => !t.isPrevented || JSON.stringify(t.chosen) !== JSON.stringify([""]))).toEqual([]);
  });
});
