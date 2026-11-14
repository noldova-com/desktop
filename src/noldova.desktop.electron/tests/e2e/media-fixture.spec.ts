/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import "@noldova/context.core";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";

test.describe("media fixture", () => {
  test("settle a media switch only once the kit font it starts loading has arrived", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const application = mainProcess.application;
    const release = "held-font-release";
    const folder = path.dirname(fileURLToPath(window.url()));
    const font = (await readdir(folder, { recursive: true })).filter(t => t.endsWith(".woff2")).sort()[0] ?? String.empty;
    expect(font, "The window holds the kit's fonts").not.toBe(String.empty);
    const source = pathToFileURL(path.join(folder, font)).href;
    const held = `${source}?held`;
    await application.evaluate(({ BrowserWindow, ipcMain, net }, [url, file, event]) => {
      BrowserWindow.getAllWindows()[0]?.webContents.session.protocol.handle("file", async request => {
        if (request.url !== url)
          return net.fetch(request, { bypassCustomProtocolHandlers: true });
        await new Promise(resolve => ipcMain.once(event, resolve));
        return net.fetch(file, { bypassCustomProtocolHandlers: true });
      });
    }, [held, source, release] as const);
    try {
      await window.evaluate(url => {
        const style = document.head.appendChild(document.createElement("style"));
        style.textContent = `@font-face { font-family: "Held Face"; src: url("${url}"); } @media (forced-colors: active) { .nol-held-text { font-family: "Held Face"; } }`;
        const text = document.body.appendChild(document.createElement("span"));
        text.className = "nol-held-text";
        text.textContent = "Held";
      }, held);
      let isSettled = false;

      const switching = MediaFixture.emulateAsync(window, { forcedColors: "active" }).then(() => {
        isSettled = true;
      });
      await expect.poll(() => application.evaluate(({ ipcMain }, event) => ipcMain.listenerCount(event), release), { message: "The held font is asked for" }).toBe(1);
      const wasSettled = isSettled;
      await application.evaluate(({ ipcMain }, event) => ipcMain.emit(event), release);
      await switching;

      expect([wasSettled, isSettled]).toEqual([false, true]);
      expect(await window.evaluate(() => [...document.fonts].find(t => t.family.replaceAll("\"", "") === "Held Face")?.status ?? "none")).toBe("loaded");
    }
    finally {
      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.session.protocol.unhandle("file"));
    }
  });
});
