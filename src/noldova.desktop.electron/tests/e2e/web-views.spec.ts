/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { createServer, type Server } from "node:http";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import type { Locator, Page } from "@playwright/test";

import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

const host = "127.0.0.1";
const titles = new Map([["/first", "First page"], ["/second", "Second page"]]);
const keysPage = "<!doctype html><title>Loading</title><p>Keys</p><script>const keys = []; new PerformanceObserver((list, observer) => { if (list.getEntriesByName(\"first-contentful-paint\").length > 0) { observer.disconnect(); document.title = \"Keys\"; } }).observe({ type: \"paint\", buffered: true }); addEventListener(\"keydown\", event => { keys.push(event.key); document.title = [\"Keys\", ...keys].join(\" \"); });</script>";
const typePage = "<!doctype html><title>Loading</title><p>Type</p><input><script>const field = document.querySelector(\"input\"); const keys = []; let painted = false; let typed = false; let blurs = 0; const show = () => { if (painted) document.title = [\"Type\", field.value, ...keys, blurs].join(\" \").trim(); }; new PerformanceObserver((list, observer) => { if (list.getEntriesByName(\"first-contentful-paint\").length > 0) { observer.disconnect(); painted = true; show(); } }).observe({ type: \"paint\", buffered: true }); field.addEventListener(\"input\", () => { typed = true; show(); }); field.addEventListener(\"blur\", () => { blurs += typed ? 1 : 0; show(); }); addEventListener(\"keydown\", event => { keys.push(event.key); show(); }); field.focus();</script>";
const clicksPage ="<!doctype html><title>Clicks 0</title><body style=\"margin:0;height:100vh\"><script>let clicks = 0; addEventListener(\"mousedown\", () => { clicks += 1; document.title = `Clicks ${clicks}`; });</script></body>";
const openerPage = "<!doctype html><title>Loading</title><a href=\"/first\" target=\"_blank\" style=\"display:block;font-size:40px\">First</a><script>new PerformanceObserver((list, observer) => { if (list.getEntriesByName(\"first-contentful-paint\").length > 0) { observer.disconnect(); document.title = \"Opener\"; } }).observe({ type: \"paint\", buffered: true });</script>";

function view(window: Page, index: number): Locator {
  return window.locator(`[data-fixture-content=pages-view-${index}]`);
}

function requestAsync(window: Page, method: string, payload: unknown): Promise<unknown> {
  return PageBridgeFixture.payloadAsync(window, method, payload);
}

async function eventsAsync(window: Page): Promise<string[]> {
  const events = await requestAsync(window, "pages.events", null);
  return Array.isArray(events) ? events.filter(Object.isString) : [];
}

async function listAsync(window: Page): Promise<JsonReader[]> {
  const views = await requestAsync(window, "pages.list", null);
  return Array.isArray(views) ? views.map(t => JsonReader.fromValue(t)) : [];
}

function readPlacesAsync(window: Page): Promise<unknown> {
  return window.evaluate(() => [...document.querySelectorAll("webview")].map(t => {
    const rect = t.getBoundingClientRect();
    return [t.checkVisibility({ opacityProperty: true, visibilityProperty: true }), { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }];
  }));
}

function readViewIdsAsync(mainProcess: MainProcessFixture): Promise<number[]> {
  return mainProcess.application.evaluate(({ webContents }) => webContents.getAllWebContents().filter(t => t.getType() === "webview").map(t => t.id).sort((a, b) => a - b));
}

function readViewBoxAsync(window: Page): Promise<{ x: number; y: number; width: number; height: number } | null> {
  return window.evaluate(() => {
    const first = document.querySelector("webview");
    if (first === null)
      return null;
    const rect = first.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

function detachFirstDebuggerAsync(mainProcess: MainProcessFixture): Promise<boolean> {
  return mainProcess.application.evaluate(({ webContents }) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    if (first === undefined)
      return false;
    first.debugger.detach();
    return true;
  });
}

function focusFirstViewAsync(mainProcess: MainProcessFixture): Promise<boolean> {
  return mainProcess.application.evaluate(async ({ app, webContents }) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    if (first === undefined)
      return false;
    app.focus({ steal: true });
    first.focus();
    return first.isFocused() && await first.executeJavaScript("document.hasFocus()") === true;
  });
}

async function pressInFirstViewAsync(mainProcess: MainProcessFixture, keyCode: string, modifiers: readonly ("control" | "meta" | "shift")[] = []): Promise<void> {
  await expect.poll(() => focusFirstViewAsync(mainProcess)).toBe(true);
  expect(await mainProcess.application.evaluate(({ webContents }, [key, held]) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    if (first === undefined)
      return false;
    for (const type of ["keyDown", "keyUp"] as const)
      first.sendInputEvent({ type, keyCode: key, modifiers: [...held] });
    return true;
  }, [keyCode, modifiers] as const)).toBe(true);
}

function readZoomsAsync(mainProcess: MainProcessFixture): Promise<number[]> {
  return mainProcess.application.evaluate(({ webContents }) =>
    webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id).map(t => Math.round(t.getZoomFactor() * 100) / 100));
}

function isFirstViewLoadingAsync(mainProcess: MainProcessFixture): Promise<boolean | null> {
  return mainProcess.application.evaluate(({ webContents }) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    return first === undefined ? null : first.isLoading();
  });
}

function crashFirstViewAsync(mainProcess: MainProcessFixture): Promise<boolean> {
  return mainProcess.application.evaluate(({ webContents }) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    if (first === undefined)
      return false;
    first.forcefullyCrashRenderer();
    return true;
  });
}

function holdClockAsync(mainProcess: MainProcessFixture, isHeld: boolean): Promise<void> {
  return mainProcess.application.evaluate((_, held) => {
    if (!held) {
      if (globalThis.nativePerformanceNow !== undefined)
        performance.now = globalThis.nativePerformanceNow;
      return;
    }
    globalThis.nativePerformanceNow ??= performance.now.bind(performance);
    const at = globalThis.nativePerformanceNow() + 2000;
    performance.now = (): number => at;
  }, isHeld);
}

function runInFirstViewAsync(mainProcess: MainProcessFixture, script: string): Promise<boolean> {
  return mainProcess.application.evaluate(async ({ webContents }, code) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    if (first === undefined)
      return false;
    await first.executeJavaScript(code);
    return true;
  }, script);
}

function clickInFirstViewAsync(mainProcess: MainProcessFixture, x: number, y: number): Promise<boolean> {
  return mainProcess.application.evaluate(({ webContents }, [left, top]) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    if (first === undefined)
      return false;
    for (const type of ["mouseDown", "mouseUp"] as const)
      first.sendInputEvent({ type, x: left, y: top, button: "left", clickCount: 1 });
    return true;
  }, [x, y] as const);
}

function isFirstDebuggerAttachedAsync(mainProcess: MainProcessFixture): Promise<boolean> {
  return mainProcess.application.evaluate(({ webContents }) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    return first !== undefined && first.debugger.isAttached();
  });
}

function countWindowsAsync(mainProcess: MainProcessFixture): Promise<number> {
  return mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
}

function portOf(server: Server): number {
  const address = server.address();
  if (Object.isNull(address) || Object.isString(address))
    throw new Error("The test server is not listening on a port.");
  return address.port;
}

async function startServerAsync(): Promise<Server> {
  const server = createServer((request, response) => {
    if (request.url === "/keys") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(keysPage);
      return;
    }
    if (request.url === "/type") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(typePage);
      return;
    }
    if (request.url === "/loading") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).write("<!doctype html><title>Loading page</title><p>Loading page</p>");
      return;
    }
    if (request.url === "/clicks") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(clicksPage);
      return;
    }
    if (request.url === "/opener") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(openerPage);
      return;
    }
    const title = titles.get(request.url ?? String.empty);
    if (Object.isUndefined(title)) {
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

test.describe("web views", () => {
  test("a module's document opens two web views over its content and shows the first, its runtime part loads each from the one loopback origin it allows, is refused another, captures the shown one through the relay, attaches to it again once its debugger detaches, and both close with the document", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const tab = window.locator("nol-tab[data-tab-key=\"document/pages.page/1\"]");
    const server = await startServerAsync();
    try {
      const port = portOf(server);
      const origin = `http://${host}:${port}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();

      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");

      await expect(tab).toHaveAttribute("aria-selected", "true");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await expect(window.locator("[data-fixture-content=pages-failure]")).toHaveText(String.empty);
      const ids = [await view(window, 0).getAttribute("data-view"), await view(window, 1).getAttribute("data-view")];
      const content = await window.locator("[data-fixture-content=pages-content]").evaluate(t => {
        const rect = t.getBoundingClientRect();
        return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
      });
      expect(content.width * content.height).toBeGreaterThan(0);
      await expect.poll(() => readPlacesAsync(window)).toEqual([[true, content], [false, expect.anything()]]);
      await expect.poll(() => requestAsync(window, "pages.list", null)).toEqual(ids.map(id => ({ id, pane: "pages.page", instance: "1", profileKey: "main" })));

      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/first` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("First page");
      expect(await requestAsync(window, "pages.navigate", { view: 1, url: `${origin}/second` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 1)).toHaveText("Second page");
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `http://localhost:${port}/first` })).toEqual({ kind: "Refused", origin: `http://localhost:${port}` });
      expect(await requestAsync(window, "pages.capture", 0)).toBeGreaterThan(0);
      await expect(view(window, 0)).toHaveText("First page");
      expect(await requestAsync(window, "pages.events", null)).toEqual(expect.arrayContaining(ids.flatMap(id => [`${id} Opened`, `${id} State`])));

      expect(await detachFirstDebuggerAsync(mainProcess)).toBe(true);
      await expect.poll(() => isFirstDebuggerAttachedAsync(mainProcess)).toBe(true);
      await expect.poll(() => requestAsync(window, "pages.capture", 0)).toBeGreaterThan(0);
      expect(await requestAsync(window, "pages.list", null)).toEqual(ids.map(id => ({ id, pane: "pages.page", instance: "1", profileKey: "main" })));
      expect(await requestAsync(window, "pages.events", null)).not.toEqual(expect.arrayContaining([`${ids[0]} Closed`]));

      await tab.focus();
      await window.keyboard.press("ControlOrMeta+KeyW");

      await expect(tab).toHaveCount(0);
      await expect.poll(() => requestAsync(window, "pages.list", null)).toEqual([]);
      await expect.poll(() => requestAsync(window, "pages.events", null)).toEqual(expect.arrayContaining(ids.map(id => `${id} Closed`)));
      await expect.poll(() => readPlacesAsync(window)).toEqual([]);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a key pressed in a module's web view runs the window's shortcut, reaches the window part as a key the module declares, or else reaches the page, and a key the runtime part sends through the relay is passed on, never taken for the person's", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const mod = process.platform === "darwin" ? "meta" : "control";
    const nativeF7 = process.platform === "darwin" ? 98 : process.platform === "win32" ? 118 : 73;
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/keys` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Keys");
      const id = await view(window, 0).getAttribute("data-view");

      await pressInFirstViewAsync(mainProcess, "F7");
      await expect(view(window, 0)).toHaveAttribute("data-keys", "find ");
      await requestAsync(window, "pages.press", { view: 0, key: "F7", code: "F7", nativeKeyCode: nativeF7 });
      await pressInFirstViewAsync(mainProcess, "5");
      await expect(view(window, 0)).toHaveText("Keys F7 5");
      await expect(view(window, 0)).toHaveAttribute("data-keys", "find ");
      await pressInFirstViewAsync(mainProcess, "P", [mod, "shift"]);
      await expect(window.getByRole("combobox", { name: /^Search / })).toBeVisible();
      await pressInFirstViewAsync(mainProcess, "6");
      await expect(view(window, 0)).toHaveText("Keys F7 5 6");

      await expect(view(window, 0)).toHaveAttribute("data-keys", "find ");
      expect(await requestAsync(window, "pages.events", null)).not.toEqual(expect.arrayContaining([`${id} Key`]));
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a key and text the runtime part sends through the relay reach the focused field of its web view's page, which keeps that field's focus, while the person's focus and keys stay in the window", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const tab = window.locator("nol-tab[data-tab-key=\"document/pages.page/1\"]");
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/type` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Type 0");
      await tab.focus();

      await requestAsync(window, "pages.type", { view: 0, text: "héllo" });
      await requestAsync(window, "pages.press", { view: 0, key: "q", code: "KeyQ", nativeKeyCode: 0 });
      await expect(view(window, 0)).toHaveText("Type héllo q 0");
      await window.keyboard.press("x");
      await requestAsync(window, "pages.press", { view: 0, key: "w", code: "KeyW", nativeKeyCode: 0 });

      await expect(view(window, 0)).toHaveText("Type héllo q w 0");
      await expect(tab).toBeFocused();
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a module's web view zooms on the person's keys, alone and across its navigations, reports each zoom to the window part, and finds in its page", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const mod = process.platform === "darwin" ? "meta" : "control";
    const server = await startServerAsync();
    try {
      const port = portOf(server);
      const origin = `http://${host}:${port}`;
      const otherSite = `http://localhost:${port}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin, otherSite]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/first` })).toEqual({ kind: "Started", origin: null });
      expect(await requestAsync(window, "pages.navigate", { view: 1, url: `${origin}/second` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("First page");
      await expect(view(window, 1)).toHaveText("Second page");

      await pressInFirstViewAsync(mainProcess, "=", [mod]);
      await expect(view(window, 0)).toHaveAttribute("data-zoom", "1.1");
      await pressInFirstViewAsync(mainProcess, "=", [mod]);
      await expect(view(window, 0)).toHaveAttribute("data-zoom", "1.25");
      expect(await readZoomsAsync(mainProcess)).toEqual([1.25, 1]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/second` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Second page");
      expect(await readZoomsAsync(mainProcess)).toEqual([1.25, 1]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${otherSite}/first` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("First page");
      expect(await readZoomsAsync(mainProcess)).toEqual([1.25, 1]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/second` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Second page");
      expect(await readZoomsAsync(mainProcess)).toEqual([1.25, 1]);
      await expect(view(window, 0)).toHaveAttribute("data-zoom", "1.25");
      await pressInFirstViewAsync(mainProcess, "0", [mod]);
      await expect(view(window, 0)).toHaveAttribute("data-zoom", "1");
      expect(await readZoomsAsync(mainProcess)).toEqual([1, 1]);
      await expect(view(window, 1)).toHaveAttribute("data-zoom", String.empty);

      await pressInFirstViewAsync(mainProcess, "F7");
      await expect(view(window, 0)).toHaveAttribute("data-found", "1 1");
      await pressInFirstViewAsync(mainProcess, "F8");
      await expect(view(window, 0)).toHaveAttribute("data-found", "2 1");
      await pressInFirstViewAsync(mainProcess, "F9");
      await expect(view(window, 0)).toHaveAttribute("data-found", "2 2");
      await pressInFirstViewAsync(mainProcess, "F9");
      await expect(view(window, 0)).toHaveAttribute("data-found", "2 1");
      await pressInFirstViewAsync(mainProcess, "F9", ["shift"]);
      await expect(view(window, 0)).toHaveAttribute("data-found", "2 2");
      await pressInFirstViewAsync(mainProcess, "F7", ["shift"]);
      await expect(view(window, 0)).toHaveAttribute("data-found", "0 0", { timeout: 5_000 });
      await expect(window.locator("[data-fixture-content=pages-failure]")).toHaveText(String.empty);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a module's layer draws its own element over its live web view in the window's page, within the view's box, in the window's theme and in forced colours, lets the person's clicks through to the page, stays under the window's own overlays, and closes with the view", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const tab = window.locator("nol-tab[data-tab-key=\"document/pages.page/1\"]");
    const mark = window.locator("[data-fixture-content=pages-mark]");
    const server = await startServerAsync();
    try {
      const port = portOf(server);
      const origin = `http://${host}:${port}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/clicks` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Clicks 0");

      await expect.poll(async () => {
        await clickInFirstViewAsync(mainProcess, 30, 50);
        return await view(window, 0).textContent();
      }).not.toBe("Clicks 0");
      const clicks = Number((await view(window, 0).textContent())?.replace("Clicks ", String.empty));
      await pressInFirstViewAsync(mainProcess, "F8", ["shift"]);
      await expect(window.locator("[data-fixture-content=pages-failure]")).toHaveAttribute("data-layer", "open");
      await expect(mark).toHaveText("Mark");
      const viewBox = await readViewBoxAsync(window);
      if (Object.isNull(viewBox))
        throw new Error("The view has no element in the window.");
      const look = await mark.evaluate((t, [left, top]) => {
        const rem = Number.parseFloat(getComputedStyle(t.ownerDocument.documentElement).fontSize);
        const rect = t.getBoundingClientRect();
        const center = t.ownerDocument.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          box: [(rect.left - left) / rem, (rect.top - top) / rem, rect.width / rem, rect.height / rem],
          pointer: getComputedStyle(t).pointerEvents,
          atCenter: center?.closest("webview")?.tagName ?? null
        };
      }, [viewBox.x, viewBox.y] as const);

      expect(look).toEqual({ box: [1.25, 2.5, 10, 3], pointer: "none", atCenter: "WEBVIEW" });
      await window.mouse.click(viewBox.x + 30, viewBox.y + 50);
      await expect(view(window, 0)).toHaveText(`Clicks ${clicks + 1}`);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/first` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("First page");
      await expect(mark).toHaveText("Mark");

      for (const mode of WindowModeFixture.modes) {
        await WindowModeFixture.setAsync(window, mode);
        const text = await window.evaluate(() => {
          const probe = document.body.appendChild(document.createElement("span"));
          probe.style.color = "var(--nol-text)";
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        });
        await expect(mark).toHaveCSS("color", text);
      }
      await MediaFixture.emulateAsync(window, { forcedColors: "active" });
      const canvasText = await window.evaluate(() => {
        const probe = document.body.appendChild(document.createElement("span"));
        probe.style.color = "CanvasText";
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
      await expect(mark).toHaveCSS("color", canvasText);
      await MediaFixture.emulateAsync(window, { forcedColors: null });

      const covered = await window.evaluate(([left, top, width, height]) => {
        const cover = document.body.appendChild(document.createElement("div"));
        cover.style.cssText = "position:fixed;inset:0;z-index:2147483647";
        const atCenter = document.elementFromPoint(left + width / 2, top + height / 2);
        const atMark = document.elementFromPoint(left + 30, top + 50);
        cover.remove();
        return [atCenter === cover, atMark === cover];
      }, [viewBox.x, viewBox.y, viewBox.width, viewBox.height] as const);
      expect(covered).toEqual([true, true]);
      expect(await readPlacesAsync(window)).toEqual(expect.arrayContaining([[true, expect.anything()]]));

      await tab.focus();
      await window.keyboard.press("ControlOrMeta+KeyW");

      await expect(tab).toHaveCount(0);
      await expect(mark).toHaveCount(0);
      await expect.poll(() => readPlacesAsync(window)).toEqual([]);
      expect(await countWindowsAsync(mainProcess)).toBe(1);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a module's web view keeps its zoom when its page crashes after crossing sites and the module navigates it again, and its zoom keys and find still work", async ({ mainProcess }) => {
    await mainProcess.stopTracingAsync();
    const window = mainProcess.window;
    const mod = process.platform === "darwin" ? "meta" : "control";
    const server = await startServerAsync();
    try {
      const port = portOf(server);
      const origin = `http://${host}:${port}`;
      const otherSite = `http://localhost:${port}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin, otherSite]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/first` })).toEqual({ kind: "Started", origin: null });
      expect(await requestAsync(window, "pages.navigate", { view: 1, url: `${origin}/second` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("First page");
      await expect(view(window, 1)).toHaveText("Second page");

      await pressInFirstViewAsync(mainProcess, "=", [mod]);
      await expect(view(window, 0)).toHaveAttribute("data-zoom", "1.1");
      await pressInFirstViewAsync(mainProcess, "=", [mod]);
      await expect(view(window, 0)).toHaveAttribute("data-zoom", "1.25");
      expect(await readZoomsAsync(mainProcess)).toEqual([1.25, 1]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${otherSite}/second` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Second page");
      expect(await readZoomsAsync(mainProcess)).toEqual([1.25, 1]);
      await expect.poll(() => isFirstViewLoadingAsync(mainProcess)).toBe(false);
      expect(await crashFirstViewAsync(mainProcess)).toBe(true);
      await expect(view(window, 0)).toHaveAttribute("data-event", "Crashed");
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/first` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("First page");
      expect(await readZoomsAsync(mainProcess)).toEqual([1.25, 1]);
      await expect(view(window, 0)).toHaveAttribute("data-zoom", "1.25");
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/second` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Second page");
      await pressInFirstViewAsync(mainProcess, "0", [mod]);
      await expect(view(window, 0)).toHaveAttribute("data-zoom", "1");
      expect(await readZoomsAsync(mainProcess)).toEqual([1, 1]);
      await expect(view(window, 1)).toHaveAttribute("data-zoom", String.empty);
      await pressInFirstViewAsync(mainProcess, "F7");
      await expect(view(window, 0)).toHaveAttribute("data-found", "1 1");
      await pressInFirstViewAsync(mainProcess, "F8");
      await expect(view(window, 0)).toHaveAttribute("data-found", "2 1");
      await expect(window.locator("[data-fixture-content=pages-failure]")).toHaveText(String.empty);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a module's web view that crashes while its page still loads reports Crashed last, with no State from that load after it", async ({ mainProcess }) => {
    await mainProcess.stopTracingAsync();
    const window = mainProcess.window;
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/loading` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Loading page");
      expect(await isFirstViewLoadingAsync(mainProcess)).toBe(true);

      expect(await crashFirstViewAsync(mainProcess)).toBe(true);
      await expect(view(window, 0)).toHaveAttribute("data-event", "Crashed");
      await expect.poll(() => isFirstViewLoadingAsync(mainProcess)).toBe(false);
      expect(await requestAsync(window, "pages.navigate", { view: 1, url: `${origin}/second` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 1)).toHaveText("Second page");

      expect(await view(window, 0).getAttribute("data-event")).toBe("Crashed");
      await expect(window.locator("[data-fixture-content=pages-failure]")).toHaveText(String.empty);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a module that takes new-window requests gets a script's and a link's, the second saying the person's input came just before, opens each in a view of its own, and the host refuses a burst over five a second", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/opener` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Opener");
      const id = await view(window, 0).getAttribute("data-view");

      expect(await runInFirstViewAsync(mainProcess, "window.open('/second')")).toBe(true);
      await expect(view(window, 0)).toHaveAttribute("data-requests", `${origin}/second false ${origin}\n`);
      await expect(view(window, 1)).toHaveText("Second page");
      expect(await clickInFirstViewAsync(mainProcess, 20, 20)).toBe(true);
      await expect(view(window, 0)).toHaveAttribute("data-requests", `${origin}/second false ${origin}\n${origin}/first true ${origin}\n`);
      await expect(view(window, 1)).toHaveText("First page");
      expect(await readPlacesAsync(window)).toHaveLength(2);

      await holdClockAsync(mainProcess, true);
      const burst = await runInFirstViewAsync(mainProcess, "for (let index = 0; index < 7; index++) window.open('/first?' + index)").finally(() => holdClockAsync(mainProcess, false));
      expect(burst).toBe(true);
      const countAsync = async (): Promise<[number, number]> => [
        ((await view(window, 0).getAttribute("data-requests")) ?? String.empty).split("\n").filter(t => t.length > 0).length - 2,
        (await eventsAsync(window)).filter(t => t === `${id} RequestRefused`).length
      ];
      await expect.poll(async () => (await countAsync()).reduce((sum, t) => sum + t, 0)).toBe(7);
      expect(await countAsync()).toEqual([5, 2]);
      expect(await readPlacesAsync(window)).toHaveLength(2);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a view whose window loads its page again while the view's own page starts loading closes without a failed load", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      const views = await listAsync(window);
      const before = views.map(t => t.readString("id"));
      expect(before).toHaveLength(2);
      for (const place of new Set(views.map(t => JSON.stringify({ document: t.readString("pane"), instance: t.readString("instance") }))))
        await expect.poll(async () => JSON.stringify(await PageBridgeFixture.evaluateAsync(window, t => t.readLayout()))).toContain(place);

      const closed = await mainProcess.application.evaluate(({ BrowserWindow, webContents }, url) => {
        const shell = BrowserWindow.getAllWindows()[0];
        const pages = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
        const [page] = pages;
        if (shell === undefined || page === undefined)
          return [];
        const ids = pages.map(t => t.id);
        void page.loadURL(url).catch(() => undefined);
        shell.webContents.reload();
        return ids;
      }, `${origin}/second`);

      expect(closed).toHaveLength(2);
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await expect.poll(async () => (await readViewIdsAsync(mainProcess)).map(t => closed.includes(t))).toEqual([false, false]);
      await expect.poll(async () => (await listAsync(window)).map(t => before.includes(t.readString("id")))).toEqual([false, false]);
      await expect.poll(() => requestAsync(window, "pages.events", null)).toEqual(expect.arrayContaining(before.map(id => `${id} Closed`)));
      expect((await eventsAsync(window)).filter(t => before.some(id => t === `${id} LoadFailed`))).toEqual([]);
    }
    finally {
      await stopServerAsync(server);
    }
  });
});
