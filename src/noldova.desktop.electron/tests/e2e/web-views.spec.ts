/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { crc32, deflateSync } from "node:zlib";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import type { Locator, Page } from "@playwright/test";

import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { TabDragFixture } from "./fixtures/tab-drag.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

const host = "127.0.0.1";
const hostReach = "[typeof require, typeof process, typeof ipcRenderer, typeof electron, Object.getOwnPropertyNames(globalThis).filter(t => /desktop|electron|ipc/iu.test(t)).length]";
const noHostReach = ["undefined", "undefined", "undefined", "undefined", 0];
const titles = new Map([["/first", "First page"], ["/second", "Second page"], ["/a", "Page A"], ["/b", "Page B"]]);
const iconRequests: string[] = [];
const keysPage = "<!doctype html><title>Loading</title><p>Keys</p><script>const keys = []; new PerformanceObserver((list, observer) => { if (list.getEntriesByName(\"first-contentful-paint\").length > 0) { observer.disconnect(); document.title = \"Keys\"; } }).observe({ type: \"paint\", buffered: true }); addEventListener(\"keydown\", event => { keys.push(event.key); document.title = [\"Keys\", ...keys].join(\" \"); });</script>";
const typePage = "<!doctype html><title>Loading</title><p>Type</p><input><script>const field = document.querySelector(\"input\"); const keys = []; let painted = false; let typed = false; let blurs = 0; const show = () => { if (painted) document.title = [\"Type\", field.value, ...keys, blurs].join(\" \").trim(); }; new PerformanceObserver((list, observer) => { if (list.getEntriesByName(\"first-contentful-paint\").length > 0) { observer.disconnect(); painted = true; show(); } }).observe({ type: \"paint\", buffered: true }); field.addEventListener(\"input\", () => { typed = true; show(); }); field.addEventListener(\"blur\", () => { blurs += typed ? 1 : 0; show(); }); addEventListener(\"keydown\", event => { keys.push(event.key); show(); }); field.focus();</script>";
const formPage = "<!doctype html><title>Form</title><body style=\"margin:0\"><input style=\"position:fixed;top:0\"><div style=\"height:5000px\"></div><script>const field = document.querySelector(\"input\"); field.focus();</script></body>";
const manualFormPage = formPage.replace("<script>", "<script>history.scrollRestoration = \"manual\"; ");
const formScript = "[document.querySelector(\"input\").value, Math.round(scrollY), globalThis.kept === true]";
const focusPage = "<!doctype html><title>Loading</title><body style=\"margin:0\"><input id=\"first\" style=\"position:absolute;left:10px;top:10px;width:150px;height:30px\"><input id=\"second\" style=\"position:absolute;left:200px;top:10px;width:150px;height:30px\"><p style=\"position:absolute;left:400px;top:10px;margin:0\">Focus</p><a href=\"/focus?linked\" style=\"position:absolute;left:10px;top:60px;width:150px;height:30px;display:block\">Next</a><script>const first = document.getElementById(\"first\"); const second = document.getElementById(\"second\"); const keys = []; let painted = false; let blurs = 0; const show = () => { if (painted) document.title = [\"Focus\", first.value || \"-\", second.value || \"-\", document.activeElement?.id || \"-\", blurs, ...keys].join(\" \"); }; new PerformanceObserver((list, observer) => { if (list.getEntriesByName(\"first-contentful-paint\").length > 0) { observer.disconnect(); painted = true; show(); } }).observe({ type: \"paint\", buffered: true }); for (const field of [first, second]) { field.addEventListener(\"input\", show); field.addEventListener(\"focus\", show); } addEventListener(\"blur\", () => { blurs += 1; show(); }); addEventListener(\"keydown\", event => { keys.push(event.key); show(); });</script></body>";
const clicksPage ="<!doctype html><title>Clicks 0</title><body style=\"margin:0;height:100vh\"><script>let clicks = 0; addEventListener(\"mousedown\", () => { clicks += 1; document.title = `Clicks ${clicks}`; });</script></body>";
const handlersPage = "<!doctype html><title>Loading</title><body style=\"margin:0\"><div id=\"d\" style=\"width:100px;height:40px\">D</div><a href=\"/a\" target=\"_blank\" style=\"display:block;width:100px;height:40px\">A</a><script>const d = document.getElementById(\"d\"); d.addEventListener(\"auxclick\", e => { if (e.button === 1) { window.open(\"/a\"); window.open(\"/b\"); } }); d.addEventListener(\"click\", e => { if (e.ctrlKey || e.metaKey) { window.open(\"/a\"); window.open(\"/b\"); } }); new PerformanceObserver((list, observer) => { if (list.getEntriesByName(\"first-contentful-paint\").length > 0) { observer.disconnect(); document.title = \"Handlers\"; } }).observe({ type: \"paint\", buffered: true }); addEventListener(\"message\", e => { if (e.data === \"open\") window.open(\"/c\"); });</script></body>";
const framedPage = (source: string): string => `<!doctype html><title>Loading</title><body style="margin:0"><iframe src="${source}/handlers" style="position:absolute;left:0;top:0;width:300px;height:120px;border:0" onload="document.title = 'Framed'"></iframe><script>addEventListener("pointerdown", e => { if (e.button !== 1) return; frames[0].postMessage("open", "*"); const end = performance.now() + 300; while (performance.now() < end); window.open("/d"); });</script></body>`;
const openerPage = "<!doctype html><title>Loading</title><a href=\"/first\" target=\"_blank\" style=\"display:block;font-size:40px\">First</a><script>new PerformanceObserver((list, observer) => { if (list.getEntriesByName(\"first-contentful-paint\").length > 0) { observer.disconnect(); document.title = \"Opener\"; } }).observe({ type: \"paint\", buffered: true });</script>";

function png(side: number): Buffer {
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(2, 9);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.alloc((side * 3 + 1) * side))), chunk("IEND", Buffer.alloc(0))]);
}

function ico(): Buffer {
  const image = Buffer.alloc(48);
  image.writeUInt32LE(40, 0);
  image.writeInt32LE(1, 4);
  image.writeInt32LE(2, 8);
  image.writeUInt16LE(1, 12);
  image.writeUInt16LE(32, 14);
  image.writeUInt32LE(0xff3366cc, 40);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(1, 6);
  header.writeUInt8(1, 7);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(image.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, image]);
}

function iconPage(title: string, ...icons: string[]): string {
  return `<!doctype html><title>${title}</title>${icons.map(t => `<link rel="icon" href="${t}">`).join(String.empty)}<p>${title}</p>`;
}

function readIconSizeAsync(window: Page): Promise<string> {
  return view(window, 0).evaluate(async element => {
    const image = new Image();
    image.src = element.getAttribute("data-icon") ?? String.empty;
    await image.decode();
    return `${image.naturalWidth}x${image.naturalHeight}`;
  });
}

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

function shiftClockAsync(mainProcess: MainProcessFixture, milliseconds: number): Promise<void> {
  return mainProcess.application.evaluate((_, shift) => {
    const native = globalThis.nativePerformanceNow ?? performance.now.bind(performance);
    globalThis.nativePerformanceNow = native;
    globalThis.clockShift = (globalThis.clockShift ?? 0) + shift;
    performance.now = (): number => native() + (globalThis.clockShift ?? 0);
  }, milliseconds);
}

function readFirstViewFramesAsync(mainProcess: MainProcessFixture): Promise<readonly [number, number] | null> {
  return mainProcess.application.evaluate(({ webContents }) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    const frame = first?.mainFrame.frames[0];
    return first === undefined || frame === undefined ? null : [first.mainFrame.processId, frame.processId] as const;
  });
}

function isFirstViewFrameHoveredAsync(mainProcess: MainProcessFixture): Promise<boolean> {
  return mainProcess.application.evaluate(({ webContents }) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    const frame = first?.mainFrame.frames[0];
    return frame === undefined ? false : frame.executeJavaScript("document.querySelector(':hover') !== null").then(t => t === true, () => false);
  });
}

async function hoverFirstViewFrameAsync(window: Page, mainProcess: MainProcessFixture, x: number, y: number): Promise<boolean> {
  await window.mouse.move(x + 1, y);
  await window.mouse.move(x, y);
  return isFirstViewFrameHoveredAsync(mainProcess);
}

async function readRequestsWithoutInputAsync(window: Page, from: number): Promise<string[]> {
  const requests = (await view(window, 0).getAttribute("data-requests")) ?? String.empty;
  return requests.slice(from).split("\n").map(t => t.split(" ").filter((_, index) => index !== 1).join(" "));
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

function runInViewAtAsync(mainProcess: MainProcessFixture, url: string, script: string): Promise<unknown> {
  return mainProcess.application.evaluate(({ webContents }, [address, code]) => {
    const guest = webContents.getAllWebContents().find(t => t.getType() === "webview" && t.getURL() === address);
    return guest === undefined ? null : guest.executeJavaScript(code).catch(() => null);
  }, [url, script] as const);
}

function holdsPageStateAsync(mainProcess: MainProcessFixture, url: string, text: string): Promise<boolean> {
  return mainProcess.application.evaluate(({ webContents }, [address, typed]) => {
    const guest = webContents.getAllWebContents().find(t => t.getType() === "webview" && t.getURL() === address);
    if (guest === undefined)
      return false;
    const state = guest.navigationHistory.getAllEntries()[guest.navigationHistory.getActiveIndex()]?.pageState;
    return typeof state === "string" && Buffer.from(state, "base64").includes(Buffer.from(typed, "utf16le"));
  }, [url, text] as const);
}

function readFirstViewAsync(mainProcess: MainProcessFixture, script: string): Promise<unknown> {
  return mainProcess.application.evaluate(({ webContents }, code) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    return first === undefined ? null : first.executeJavaScript(code);
  }, script);
}

function readFirstViewFrameAsync(mainProcess: MainProcessFixture, script: string): Promise<unknown> {
  return mainProcess.application.evaluate(({ webContents }, code) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    const frame = first?.mainFrame.frames[0];
    return frame === undefined ? null : frame.executeJavaScript(code);
  }, script);
}

function readFirstViewAddressAsync(mainProcess: MainProcessFixture): Promise<{ address: string; isLoading: boolean } | null> {
  return mainProcess.application.evaluate(({ webContents }) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    return first === undefined ? null : { address: first.getURL(), isLoading: first.isLoading() };
  });
}

function clickInFirstViewAsync(mainProcess: MainProcessFixture, x: number, y: number, button: "left" | "middle" = "left", clicks: number = 1): Promise<boolean> {
  return mainProcess.application.evaluate(({ webContents }, [left, top, pressed, count]) => {
    const [first] = webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id);
    if (first === undefined)
      return false;
    for (let index = 0; index < count; index++)
      for (const type of ["mouseDown", "mouseUp"] as const)
        first.sendInputEvent({ type, x: left, y: top, button: pressed, clickCount: 1 });
    return true;
  }, [x, y, button, clicks] as const);
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
    if ((request.url ?? String.empty).startsWith("/form?")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(request.url?.endsWith("&manual") === true ? manualFormPage : formPage);
      return;
    }
    if (request.url === "/focus" || (request.url ?? String.empty).startsWith("/focus?")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(focusPage);
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
    if (request.url === "/handlers") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(handlersPage);
      return;
    }
    if (request.url?.startsWith("/framed?") === true) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(framedPage(decodeURIComponent(request.url.slice("/framed?".length))));
      return;
    }
    if (request.url === "/opener") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(openerPage);
      return;
    }
    if (request.url === "/large.png" || request.url === "/small.png") {
      iconRequests.push(`${request.headers.host ?? String.empty}${request.url}`);
      response.writeHead(200, { "Content-Type": "image/png" }).end(png(request.url === "/large.png" ? 128 : 16));
      return;
    }
    if (request.url === "/icon.ico") {
      iconRequests.push(request.url);
      response.writeHead(200, { "Content-Type": "image/x-icon" }).end(ico());
      return;
    }
    if (request.url === "/huge.png") {
      iconRequests.push(request.url);
      const icon = png(16);
      response.writeHead(200, { "Content-Type": "image/png" }).end(Buffer.concat([icon, Buffer.alloc(1_048_577 - icon.length)]));
      return;
    }
    if (request.url === "/moved.png") {
      iconRequests.push(request.url);
      response.writeHead(302, { Location: "/small.png" }).end();
      return;
    }
    if (request.url === "/missing.png") {
      iconRequests.push(request.url);
      response.writeHead(404, { "Content-Type": "image/png" }).end(png(16));
      return;
    }
    if (request.url?.startsWith("/icon-of?") === true) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(iconPage("Icon page", request.url.slice("/icon-of?".length)));
      return;
    }
    if (request.url === "/icon") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(iconPage("Icon page", "/large.png"));
      return;
    }
    if (request.url?.startsWith("/foreign-icon?") === true) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(iconPage("Foreign icon page", `${decodeURIComponent(request.url.slice("/foreign-icon?".length))}/small.png`, "/small.png"));
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

  test("a shortcut pressed in a module's web view while its command is disabled reaches the page before the keys after it, and once enabled runs the command without the page seeing it", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const mod = process.platform === "darwin" ? "meta" : "control";
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

      await pressInFirstViewAsync(mainProcess, "L", [mod, "shift"]);
      await pressInFirstViewAsync(mainProcess, "5");
      await expect(view(window, 0)).toHaveText(/^Keys [Ll] 5$/);
      await expect(window.getByRole("tab", { name: /Marked page/ })).toHaveCount(0);

      await CommandSearchFixture.searchAsync(window, "Allow the mark");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.allowMark");
      await window.keyboard.press("Enter");
      await pressInFirstViewAsync(mainProcess, "L", [mod, "shift"]);
      await expect(window.getByRole("tab", { name: /Marked page/ })).toHaveCount(1);
      await pressInFirstViewAsync(mainProcess, "6");
      await expect(view(window, 0)).toHaveText(/^Keys [Ll] 5 6$/);
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

  test("F6 pressed in a module's web view moves the window's focus out of the view to the next region, the status bar after the view's group, and Shift+F6 brings it back into the view", async ({ mainProcess }) => {
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
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/keys` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Keys");
      const focus = (): Promise<string> => window.evaluate(() => {
        const active = document.activeElement;
        if (active === null)
          return "none";
        if (active.classList.contains("nol-web-view-guest"))
          return "view";
        if (active.closest(".nol-web-view") !== null)
          return "inside";
        return active.closest("nol-status-bar") === null ? active.tagName : "status bar";
      });
      await window.evaluate(() => [...document.querySelectorAll<HTMLElement>(".nol-web-view-guest")].find(t => t.checkVisibility({ visibilityProperty: true }))?.focus());
      await expect.poll(focus).toBe("view");

      await pressInFirstViewAsync(mainProcess, "F6");
      await expect.poll(focus).toBe("status bar");
      await window.keyboard.press("Shift+F6");
      await expect.poll(focus).toBe("view");
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

  test("a focus and a click the runtime part sends through the relay reach a field of its web view's page, while the person's focus and keys stay on their tab and the page sees no blur", async ({ mainProcess }) => {
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
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/focus` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Focus - - - 0");
      await tab.focus();

      await requestAsync(window, "pages.focus", { view: 0, id: "second" });
      await requestAsync(window, "pages.type", { view: 0, text: "abc" });
      await expect(view(window, 0)).toHaveText("Focus - abc second 0");
      await expect(tab).toBeFocused();
      await window.keyboard.press("x");
      await requestAsync(window, "pages.click", { view: 0, x: 60, y: 25 });
      await requestAsync(window, "pages.type", { view: 0, text: "hello" });
      await expect(view(window, 0)).toHaveText("Focus hello abc first 0");
      await expect(tab).toBeFocused();
      await window.keyboard.press("y");
      await requestAsync(window, "pages.type", { view: 0, text: "!" });

      await expect(view(window, 0)).toHaveText("Focus hello! abc first 0");
      await expect(tab).toBeFocused();
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a focus and a click the runtime part sends through the relay to a web view behind another document of its group reach its page, while the person's focus and keys stay on the document in front", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const noteKey = "document/notes.note/1";
    const note = window.locator(`nol-tab[data-tab-key="${noteKey}"]`);
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/focus` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Focus - - - 0");
      await TabDragFixture.tab(window, noteKey).click();
      await expect(window.locator("[data-fixture-content=notes-note-1]")).toBeVisible();
      await expect.poll(() => readPlacesAsync(window)).toEqual([[false, expect.anything()], [false, expect.anything()]]);
      await note.focus();

      await requestAsync(window, "pages.focus", { view: 0, id: "second" });
      await requestAsync(window, "pages.type", { view: 0, text: "abc" });
      expect(await readFirstViewAsync(mainProcess, "document.title")).toBe("Focus - abc second 0");
      await expect(note).toBeFocused();
      await window.keyboard.press("x");
      await requestAsync(window, "pages.click", { view: 0, x: 60, y: 25 });
      await requestAsync(window, "pages.type", { view: 0, text: "hello" });
      expect(await readFirstViewAsync(mainProcess, "document.title")).toBe("Focus hello abc first 0");
      await expect(note).toBeFocused();
      await window.keyboard.press("y");
      await requestAsync(window, "pages.type", { view: 0, text: "!" });

      expect(await readFirstViewAsync(mainProcess, "document.title")).toBe("Focus hello! abc first 0");
      await expect(note).toBeFocused();
      await expect.poll(() => readPlacesAsync(window)).toEqual([[false, expect.anything()], [false, expect.anything()]]);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a controlled web view behind another document of its group stays painted under it, so clicks, keys and a link click the relay sends reach pages it loads by GET and by POST", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const noteKey = "document/notes.note/1";
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      const navigations = [
        [`${origin}/focus?get`, `setTimeout(() => location.assign(${JSON.stringify(`${origin}/focus?get`)}));`],
        [`${origin}/focus?post`, `setTimeout(() => { const form = document.createElement("form"); form.method = "post"; form.action = ${JSON.stringify(`${origin}/focus?post`)}; document.body.append(form); form.submit(); });`]
      ] as const;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/focus` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Focus - - - 0");
      const pane = await window.locator("[data-fixture-content=pages-content]").boundingBox();
      await requestAsync(window, "pages.control", { view: 0, isControlled: true });
      await TabDragFixture.tab(window, noteKey).click();
      await expect(window.locator("[data-fixture-content=notes-note-1]")).toBeVisible();
      const place = pane === null ? null : { x: Math.round(pane.x), y: Math.round(pane.y), width: Math.round(pane.width), height: Math.round(pane.height) };
      await expect.poll(() => readPlacesAsync(window)).toEqual([[true, place], [false, place]]);
      const cover = await window.evaluate(key => {
        const front = document.querySelector(`[data-tab-content="${key}"]`);
        const guest = document.querySelector("webview");
        if (front === null || guest === null)
          return null;
        const outer = front.getBoundingClientRect();
        const inner = guest.getBoundingClientRect();
        const style = getComputedStyle(front);
        return { background: /^rgb\(/u.test(style.backgroundColor), opacity: style.opacity, zIndex: style.zIndex, covers: outer.left <= inner.left && outer.top <= inner.top && outer.right >= inner.right && outer.bottom >= inner.bottom };
      }, noteKey);
      expect(cover).toEqual({ background: true, opacity: "1", zIndex: "1", covers: true });

      for (const [address, script] of navigations) {
        expect(await runInFirstViewAsync(mainProcess, script)).toBe(true);
        await expect.poll(() => readFirstViewAddressAsync(mainProcess)).toEqual({ address, isLoading: false });
        await expect.poll(() => readFirstViewAsync(mainProcess, "document.title")).toBe("Focus - - - 0");
        await requestAsync(window, "pages.click", { view: 0, x: 60, y: 25 });
        await requestAsync(window, "pages.type", { view: 0, text: "ab" });
        await expect.poll(() => readFirstViewAsync(mainProcess, "document.title")).toBe("Focus ab - first 0");
        await requestAsync(window, "pages.click", { view: 0, x: 60, y: 75 });
        await expect.poll(() => readFirstViewAddressAsync(mainProcess)).toEqual({ address: `${origin}/focus?linked`, isLoading: false });
        await expect.poll(() => readFirstViewAsync(mainProcess, "document.title")).toBe("Focus - - - 0");
      }

      await requestAsync(window, "pages.control", { view: 0, isControlled: false });
      await expect.poll(() => readPlacesAsync(window)).toEqual([[false, place], [false, place]]);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a module's web view behind another document of its group keeps its page, takes the runtime part's relayed calls, stays out of sight, and shows the same page with what was typed when its tab comes back, where it takes relayed calls again", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const pageKey = "document/pages.page/1";
    const noteKey = "document/notes.note/1";
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      expect(await TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, pageKey))).toContain(noteKey);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/type` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Type 0");
      await requestAsync(window, "pages.type", { view: 0, text: "héllo" });
      await expect(view(window, 0)).toHaveText("Type héllo 0");
      expect(await runInFirstViewAsync(mainProcess, "globalThis.keptPage = true;")).toBe(true);
      const ids = await readViewIdsAsync(mainProcess);

      await TabDragFixture.tab(window, noteKey).click();
      await expect(window.locator("[data-fixture-content=notes-note-1]")).toBeVisible();
      await expect.poll(() => readPlacesAsync(window)).toEqual([[false, expect.anything()], [false, expect.anything()]]);
      expect(await requestAsync(window, "pages.type", { view: 0, text: " again" })).toBeNull();
      const behind = await readFirstViewAsync(mainProcess, "[document.querySelector(\"input\").value, globalThis.keptPage === true]");
      await TabDragFixture.tab(window, pageKey).click();

      expect(behind).toEqual(["héllo again", true]);
      await expect(view(window, 0)).toHaveText(/^Type héllo again \d+$/);
      await expect.poll(() => readPlacesAsync(window)).toEqual([[true, expect.anything()], [false, expect.anything()]]);
      expect(await readFirstViewAsync(mainProcess, "[document.querySelector(\"input\").value, globalThis.keptPage === true]")).toEqual(["héllo again", true]);
      expect(await readViewIdsAsync(mainProcess)).toEqual(ids);
      expect(await requestAsync(window, "pages.type", { view: 0, text: "!" })).toBeNull();
      await expect(view(window, 0)).toHaveText(/^Type héllo again! \d+$/);
      expect(await requestAsync(window, "pages.capture", 0)).toBeGreaterThan(0);
      expect(await eventsAsync(window)).not.toEqual(expect.arrayContaining([expect.stringMatching(/ (Closed|Unavailable)$/)]));
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a module's web view binds again and answers the runtime part's relayed calls after its tab moves to another group, into a dialog and back, and after its view moves to another dock, each time restoring the page it showed with what was typed and its scroll, but not its script's state", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const pageKey = "document/pages.page/1";
    const noteKey = "document/notes.note/1";
    const sideKey = "view/pages.side/1";
    const shown = window.getByRole("dialog");
    const side = window.locator(`[data-tab-content="${sideKey}"] [data-fixture-content=pages-view-0]`);
    const typeAsync = async (index: number, url: string, text: string): Promise<void> => {
      await runInViewAtAsync(mainProcess, url, "document.querySelector(\"input\").select(); globalThis.kept = true; scrollTo(0, 1200);");
      expect(await requestAsync(window, "pages.type", { view: index, text })).toBeNull();
      await expect.poll(() => runInViewAtAsync(mainProcess, url, formScript)).toEqual([text, 1200, true]);
      await expect.poll(() => holdsPageStateAsync(mainProcess, url, text)).toBe(true);
    };
    const restoredAsync = async (url: string, text: string): Promise<void> => {
      await expect.poll(() => runInViewAtAsync(mainProcess, url, formScript)).toEqual([text, 1200, false]);
    };
    const runAsync = async (title: string): Promise<void> => {
      await CommandSearchFixture.searchAsync(window, title);
      await window.keyboard.press("Enter");
    };
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      const [pageUrl, sideUrl] = [`${origin}/form?page&manual`, `${origin}/form?side`];
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await runAsync("Open the page");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: pageUrl })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Form");
      await typeAsync(0, pageUrl, "before");

      await TabDragFixture.dragOntoPlateAsync(window, pageKey, noteKey, "Right");
      await window.mouse.up();
      await expect.poll(() => TabDragFixture.tabKeysOf(TabDragFixture.groupOf(window, pageKey))).toEqual([pageKey]);
      await restoredAsync(pageUrl, "before");
      await typeAsync(0, pageUrl, "group");

      await runAsync("Show the page in a dialog");
      await expect(shown.locator("[data-fixture-content=pages-view-0]")).toHaveText("Form");
      await restoredAsync(pageUrl, "group");
      await typeAsync(0, pageUrl, "dialog");
      await shown.getByRole("button", { name: "Close" }).click();
      await expect(shown).toHaveCount(0);
      await restoredAsync(pageUrl, "dialog");
      await typeAsync(0, pageUrl, "back");

      await runAsync("Open the side page");
      await expect(side).toHaveAttribute("data-view", /./);
      await expect(window.locator(`nol-tab-group[data-side=Bottom] nol-tab[data-tab-key="${sideKey}"]`)).toHaveCount(0);
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 2, url: sideUrl })).toEqual({ kind: "Started", origin: null });
      await expect(side).toHaveText("Form");
      await typeAsync(2, sideUrl, "docked");
      await TabDragFixture.tab(window, sideKey).focus();
      await window.keyboard.press("Shift+F10");
      await window.getByRole("menuitem", { name: "Dock", exact: true }).click();
      await window.getByRole("menuitem", { name: "Dock at the bottom" }).click();
      await expect(window.locator(`nol-tab-group[data-side=Bottom] nol-tab[data-tab-key="${sideKey}"]`)).toHaveCount(1);
      await restoredAsync(sideUrl, "docked");
      await typeAsync(2, sideUrl, "bottom");

      expect(await requestAsync(window, "pages.capture", 2)).toBeGreaterThan(0);
      expect(await requestAsync(window, "pages.capture", 0)).toBeGreaterThan(0);
      expect(mainProcess.failures.filter(t => / was refused, /.test(t))).toEqual([]);
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

  test("a module's web view reports its page's icon to the window part, scaled to at most 64 pixels, again when the page changes it, none for a page without one, and never fetches an icon from an origin it doesn't allow", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const server = await startServerAsync();
    try {
      const port = portOf(server);
      const origin = `http://${host}:${port}`;
      const otherSite = `http://localhost:${port}`;
      iconRequests.length = 0;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);

      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/icon` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveAttribute("data-icons", "png ");
      expect(await readIconSizeAsync(window)).toBe("64x64");

      await mainProcess.application.evaluate(({ webContents }) => webContents.getAllWebContents().filter(t => t.getType() === "webview").sort((a, b) => a.id - b.id)[0]
        ?.executeJavaScript("document.querySelector(\"link\").href = \"/small.png\""));
      await expect(view(window, 0)).toHaveAttribute("data-icons", "png png ");
      expect(await readIconSizeAsync(window)).toBe("16x16");

      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/first` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveAttribute("data-icons", "png png none ");

      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/foreign-icon?${encodeURIComponent(otherSite)}` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveAttribute("data-icons", "png png none png ");
      expect(await readIconSizeAsync(window)).toBe("16x16");
      expect(iconRequests.filter(t => t.startsWith("localhost"))).toEqual([]);
      await expect(window.locator("[data-fixture-content=pages-failure]")).toHaveText(String.empty);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a module's web view decodes an ICO icon, and reports none for an icon over 1 MB, one that redirects, without following it, or one whose answer is a failure", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      iconRequests.length = 0;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin]);
      const shown: string[] = [];

      for (const icon of ["/huge.png", "/moved.png", "/missing.png"]) {
        expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/icon-of?/icon.ico` })).toEqual({ kind: "Started", origin: null });
        shown.push("png");
        await expect(view(window, 0)).toHaveAttribute("data-icons", `${shown.join(" ")} `);
        expect(await readIconSizeAsync(window)).toBe("1x1");
        expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/icon-of?${icon}` })).toEqual({ kind: "Started", origin: null });
        shown.push("none");
        await expect(view(window, 0)).toHaveAttribute("data-icons", `${shown.join(" ")} `);
      }

      expect(iconRequests.filter(t => t !== "/icon.ico")).toEqual(["/huge.png", "/moved.png", "/missing.png"]);
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

  test("a module's web view refuses its page's own link, location, form and meta refresh and an allowed frame's target=\"_top\" link to an origin it doesn't allow, stays at its page, and reports NavigationRefused for each", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const server = await startServerAsync();
    try {
      const port = portOf(server);
      const origin = `http://${host}:${port}`;
      const outside = `http://localhost:${port}/second`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      const id = await view(window, 0).getAttribute("data-view");
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/first` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("First page");

      expect(await runInFirstViewAsync(mainProcess, `void Object.assign(document.body.appendChild(document.createElement("a")), { href: ${JSON.stringify(outside)} }).click()`)).toBe(true);
      await expect.poll(async () => (await eventsAsync(window)).filter(t => t === `${id} NavigationRefused`).length).toBe(1);
      expect(await runInFirstViewAsync(mainProcess, `void (location.href = ${JSON.stringify(outside)})`)).toBe(true);
      await expect.poll(async () => (await eventsAsync(window)).filter(t => t === `${id} NavigationRefused`).length).toBe(2);
      expect(await runInFirstViewAsync(mainProcess, `void Object.assign(document.body.appendChild(document.createElement("form")), { action: ${JSON.stringify(outside)}, method: "get" }).submit()`)).toBe(true);
      await expect.poll(async () => (await eventsAsync(window)).filter(t => t === `${id} NavigationRefused`).length).toBe(3);
      expect(await runInFirstViewAsync(mainProcess, `void document.head.appendChild(Object.assign(document.createElement("meta"), { httpEquiv: "refresh", content: ${JSON.stringify(`0;url=${outside}`)} }))`)).toBe(true);
      await expect.poll(async () => (await eventsAsync(window)).filter(t => t === `${id} NavigationRefused`).length).toBe(4);
      expect(await runInFirstViewAsync(mainProcess, `new Promise(resolve => { const frame = document.createElement("iframe"); frame.src = ${JSON.stringify(`${origin}/second`)}; frame.addEventListener("load", resolve); document.body.append(frame); })`)).toBe(true);
      expect(await readFirstViewAsync(mainProcess, "document.querySelector(\"iframe\").contentDocument.title")).toBe("Second page");
      expect(await runInFirstViewAsync(mainProcess, `void Object.assign(document.querySelector("iframe").contentDocument.body.appendChild(document.createElement("a")), { href: ${JSON.stringify(outside)}, target: "_top" }).click()`)).toBe(true);
      await expect.poll(async () => (await eventsAsync(window)).filter(t => t === `${id} NavigationRefused`).length).toBe(5);

      await expect.poll(() => readFirstViewAddressAsync(mainProcess)).toEqual({ address: `${origin}/first`, isLoading: false });
      await expect(view(window, 0)).toHaveText("First page");
      expect(await eventsAsync(window)).not.toContain(`${id} LoadFailed`);
    }
    finally {
      await stopServerAsync(server);
    }
  });

  test("a module's web view loads a frame's about:srcdoc, and its page's own top-level about:srcdoc, which the engine refuses itself with its error page, is reported as NavigationRefused without a LoadFailed", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      const id = await view(window, 0).getAttribute("data-view");
      await requestAsync(window, "pages.allow", [origin]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/first` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("First page");

      expect(await runInFirstViewAsync(mainProcess, "new Promise(resolve => { const frame = document.createElement(\"iframe\"); frame.srcdoc = \"<p>Inline</p>\"; frame.addEventListener(\"load\", resolve); document.body.append(frame); })")).toBe(true);
      expect(await readFirstViewAsync(mainProcess, "document.querySelector(\"iframe\").contentDocument.body.textContent")).toBe("Inline");
      expect(await eventsAsync(window)).not.toContain(`${id} NavigationRefused`);

      for (const address of ["about:srcdoc", "about:srcdoc#x"]) {
        expect(await runInFirstViewAsync(mainProcess, `void (location.href = ${JSON.stringify(address)})`)).toBe(true);
        await expect.poll(() => readFirstViewAddressAsync(mainProcess)).toEqual({ address, isLoading: false });
        expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/first` })).toEqual({ kind: "Started", origin: null });
        await expect.poll(() => readFirstViewAddressAsync(mainProcess)).toEqual({ address: `${origin}/first`, isLoading: false });
        await expect(view(window, 0)).toHaveText("First page");
      }

      const events = await eventsAsync(window);
      expect(events.filter(t => t === `${id} NavigationRefused`)).toHaveLength(2);
      expect(events).not.toContain(`${id} LoadFailed`);
      await expect(window.locator("[data-fixture-content=pages-failure]")).toHaveText(String.empty);
      await expect.poll(() => mainProcess.failures.filter(t => t.includes("Failed to load URL: about:srcdoc")).length).toBeGreaterThanOrEqual(2);
      expect(mainProcess.acceptFailures(/Failed to load URL: about:srcdoc(#x)? with error: ERR_INVALID_URL|--trace-warnings/).length).toBeGreaterThan(0);
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

  test("a module that takes new-window requests gets a script's, a popup's, a link's and a middle-clicked link's with each disposition, the links saying the person's input came just before, opens each in a view of its own, and the host refuses a burst over five a second", async ({ mainProcess }) => {
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

      const script = `${origin}/second false ${origin} foreground-tab null\n`;
      const popup = `${origin}/second false ${origin} new-window null\n`;
      const link = `${origin}/first true ${origin} foreground-tab 1\n`;
      expect(await runInFirstViewAsync(mainProcess, "window.open('/second')")).toBe(true);
      await expect(view(window, 0)).toHaveAttribute("data-requests", script);
      await expect(view(window, 1)).toHaveText("Second page");
      expect(await runInFirstViewAsync(mainProcess, "window.open('/second', '_blank', 'popup')")).toBe(true);
      await expect(view(window, 0)).toHaveAttribute("data-requests", `${script}${popup}`);
      expect(await clickInFirstViewAsync(mainProcess, 20, 20)).toBe(true);
      await expect(view(window, 0)).toHaveAttribute("data-requests", `${script}${popup}${link}`);
      await expect(view(window, 1)).toHaveText("First page");
      expect(await clickInFirstViewAsync(mainProcess, 20, 20, "middle")).toBe(true);
      await expect(view(window, 0)).toHaveAttribute("data-requests", `${script}${popup}${link}${origin}/first true ${origin} background-tab 2\n`);
      expect(await readPlacesAsync(window)).toHaveLength(2);

      await holdClockAsync(mainProcess, true);
      const burst = await runInFirstViewAsync(mainProcess, "for (let index = 0; index < 7; index++) window.open('/first?' + index)").finally(() => holdClockAsync(mainProcess, false));
      expect(burst).toBe(true);
      const countAsync = async (): Promise<[number, number]> => [
        ((await view(window, 0).getAttribute("data-requests")) ?? String.empty).split("\n").filter(t => t.length > 0).length - 4,
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

  test("a page's own handler that opens two windows during one press of the person's gets one press id for both, a second press close after it the next, a press in a cross-origin frame its own, and a relayed press, a script and a page's faked press none, while the page's script can't reach the host's press script", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const server = await startServerAsync();
    try {
      const origin = `http://${host}:${portOf(server)}`;
      const other = `http://localhost:${portOf(server)}`;
      await expect(window.locator("[data-fixture-content=notes-list]")).toBeVisible();
      await CommandSearchFixture.searchAsync(window, "Open the page");
      await expect(window.getByRole("option").first()).toHaveAttribute("data-item", "desktop.commands/pages.openPage");
      await window.keyboard.press("Enter");
      await expect(view(window, 1)).toHaveAttribute("data-view", /./);
      await requestAsync(window, "pages.allow", [origin, other]);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/handlers` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Handlers");
      const pair = (from: string, input: boolean, disposition: string, press: string): string => `${from}/a ${input} ${from} ${disposition} ${press}\n${from}/b ${input} ${from} ${disposition} ${press}\n`;

      expect(await clickInFirstViewAsync(mainProcess, 50, 20, "middle")).toBe(true);
      const one = pair(origin, true, "background-tab", "1");
      await expect(view(window, 0)).toHaveAttribute("data-requests", one);
      await shiftClockAsync(mainProcess, 1100);
      expect(await clickInFirstViewAsync(mainProcess, 50, 20, "middle", 2)).toBe(true);
      const two = `${one}${pair(origin, true, "background-tab", "2")}${pair(origin, true, "background-tab", "3")}`;
      await expect(view(window, 0)).toHaveAttribute("data-requests", two);

      expect(await readFirstViewAsync(mainProcess, hostReach)).toEqual(noHostReach);
      await shiftClockAsync(mainProcess, 6000);
      expect(await runInFirstViewAsync(mainProcess, "(() => { const target = document.getElementById('d'); for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) target.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 1, buttons: 4 })); target.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 1 })); })()")).toBe(true);
      const faked = `${two}${pair(origin, false, "foreground-tab", "null")}`;
      await expect(view(window, 0)).toHaveAttribute("data-requests", faked);
      await shiftClockAsync(mainProcess, 1100);
      await requestAsync(window, "pages.click", { view: 0, x: 50, y: 60 });
      expect(await runInFirstViewAsync(mainProcess, "window.open('/b')")).toBe(true);
      const relayed = `${faked}${origin}/a false ${origin} foreground-tab null\n${origin}/b false ${origin} foreground-tab null\n`;
      await expect(view(window, 0)).toHaveAttribute("data-requests", relayed);

      await shiftClockAsync(mainProcess, 1100);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/framed?${encodeURIComponent(other)}` })).toEqual({ kind: "Started", origin: null });
      await expect(view(window, 0)).toHaveText("Framed");
      const processes = await readFirstViewFramesAsync(mainProcess);
      expect(processes).not.toBeNull();
      expect(processes?.[0]).not.toBe(processes?.[1]);
      await expect.poll(() => readFirstViewFrameAsync(mainProcess, "document.title")).toBe("Handlers");
      expect(await readFirstViewFrameAsync(mainProcess, hostReach)).toEqual(noHostReach);
      const box = await readViewBoxAsync(window);
      if (Object.isNull(box))
        throw new Error("The view has no element in the window.");
      await expect.poll(() => hoverFirstViewFrameAsync(window, mainProcess, box.x + 50, box.y + 20)).toBe(true);
      await window.mouse.click(box.x + 50, box.y + 20, { button: "middle" });
      await expect.poll(() => readRequestsWithoutInputAsync(window, relayed.length)).toEqual([`${other}/a ${other} background-tab 4`, `${other}/b ${other} background-tab 4`, String.empty]);
      expect((await view(window, 0).getAttribute("data-requests"))?.startsWith(relayed)).toBe(true);
      const framed = (await view(window, 0).getAttribute("data-requests")) ?? String.empty;
      await shiftClockAsync(mainProcess, 1100);
      await expect.poll(async () => {
        await window.mouse.move(box.x + 351, box.y + 20);
        await window.mouse.move(box.x + 350, box.y + 20);
        return readFirstViewAsync(mainProcess, "document.documentElement.matches(':hover') && document.querySelector('iframe:hover') === null");
      }).toBe(true);
      await window.mouse.click(box.x + 350, box.y + 20, { button: "middle" });
      await expect.poll(async () => [...await readRequestsWithoutInputAsync(window, framed.length)].sort()).toEqual([`${other}/c ${other} foreground-tab null`, `${origin}/d ${origin} foreground-tab 5`, String.empty].sort());

      await shiftClockAsync(mainProcess, 1100);
      expect(await requestAsync(window, "pages.navigate", { view: 0, url: `${origin}/framed?${encodeURIComponent(origin)}` })).toEqual({ kind: "Started", origin: null });
      await expect.poll(() => readFirstViewFrameAsync(mainProcess, "document.readyState")).toBe("complete");
      expect(await readFirstViewFrameAsync(mainProcess, hostReach)).toEqual(noHostReach);
      expect(await readFirstViewAsync(mainProcess, "document.querySelector('iframe').contentDocument.getElementById('d').textContent")).toBe("D");
    }
    finally {
      await holdClockAsync(mainProcess, false);
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
