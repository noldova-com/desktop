/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import type { Page } from "@playwright/test";

import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";

const host = "127.0.0.1";
const title = "Attached page";

async function startServerAsync(): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.url !== "/attached") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(`<!doctype html><title>${title}</title><p>${title}</p>`);
  });
  server.listen(0, host);
  await once(server, "listening");
  return server;
}

async function stopServerAsync(server: Server): Promise<void> {
  server.closeAllConnections();
  server.close();
  await once(server, "close");
}

function portOf(server: Server): number {
  const address = server.address();
  if (Object.isNull(address) || Object.isString(address))
    throw new Error("The test server is not listening on a port.");
  return address.port;
}

function addWebviewAsync(window: Page, partition: string, id: string): Promise<void> {
  return window.evaluate(([name, key]) => {
    const element = document.createElement("webview");
    element.id = key;
    element.setAttribute("partition", name);
    element.setAttribute("src", "about:blank");
    element.style.cssText = "position:fixed;left:0;top:0;width:20rem;height:10rem";
    document.body.appendChild(element);
  }, [partition, id] as const);
}

function readGuestsAsync(mainProcess: MainProcessFixture): Promise<number[]> {
  return mainProcess.application.evaluate(({ BrowserWindow, webContents }) => {
    const shell = BrowserWindow.getAllWindows()[0];
    return webContents.getAllWebContents().filter(t => t.getType() === "webview" && t.hostWebContents?.id === shell?.webContents.id).map(t => t.id).sort((a, b) => a - b);
  });
}

function readGuestAsync(mainProcess: MainProcessFixture, contentsId: number, partition: string): Promise<{ url: string; title: string; isInPartition: boolean } | null> {
  return mainProcess.application.evaluate(({ session, webContents }, [id, name]) => {
    const guest = webContents.fromId(id);
    if (guest === undefined || guest.isDestroyed())
      return null;
    const storage = guest.session.getStoragePath();
    return { url: guest.getURL(), title: guest.getTitle(), isInPartition: storage !== null && storage === session.fromPartition(name).getStoragePath() };
  }, [contentsId, partition] as const);
}

test.describe("web view attach", () => {
  test("a module's web view attaches to a live <webview> in the window, loads its page in the module's own partition, and a <webview> with another partition never attaches", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const log = (): Promise<string> => readFile(path.join(mainProcess.dataDirectory, "logs", "main.log"), "utf8");
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      expect(await readGuestsAsync(mainProcess)).toEqual([]);

      const opened = JsonReader.fromValue(await PageBridgeFixture.evaluateAsync(window, t => t.openWebView("pages", { name: "pages.page", instance: "attach" }, "main")));
      const viewId = opened.readObject("view").readString("id");
      const partition = opened.readString("partition");
      await addWebviewAsync(window, partition, "attached");
      await expect.poll(() => readGuestsAsync(mainProcess)).toHaveLength(1);
      const [contentsId] = await readGuestsAsync(mainProcess);
      if (Object.isUndefined(contentsId))
        throw new Error("The <webview> has no guest.");
      const attached = await PageBridgeFixture.evaluateAsync(window, (t, [view, id]) => t.attachWebView("pages", view, id), [viewId, contentsId] as const);
      await PageBridgeFixture.payloadAsync(window, "pages.allow", [origin]);
      const navigated = await PageBridgeFixture.payloadAsync(window, "pages.navigate", { view: 0, url: `${origin}/attached` });

      expect(attached).toEqual({ isAttached: true });
      expect(navigated).toEqual({ kind: "Started", origin: null });
      await expect.poll(() => readGuestAsync(mainProcess, contentsId, partition)).toEqual({ url: `${origin}/attached`, title, isInPartition: true });

      await addWebviewAsync(window, "persist:other", "intruder");

      await expect.poll(log).toContain("A <webview> in window ");
      expect(await log()).toContain(`its partition "persist:other" belongs to no web view the window opened`);
      const refused = /A <webview> in window \d+ was refused, because its partition "persist:other"/;
      await expect.poll(() => mainProcess.failures.some(t => refused.test(t))).toBe(true);
      expect(mainProcess.acceptFailures(refused)).toHaveLength(1);
      expect(await readGuestsAsync(mainProcess)).toEqual([contentsId]);
      await expect.poll(() => readGuestAsync(mainProcess, contentsId, partition)).toEqual({ url: `${origin}/attached`, title, isInPartition: true });
    }
    finally {
      await stopServerAsync(server);
    }
  });
});
