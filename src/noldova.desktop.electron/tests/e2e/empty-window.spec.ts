/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

test.use({ mainProcessVariant: BuildVariantFixture.noModules });

const colors = {
  light: { window: "rgb(248, 248, 248)", panel: "rgb(255, 255, 255)", cardBorder: "rgb(229, 229, 229)", titleBar: "rgb(248, 248, 248)", titleBarText: "rgb(30, 30, 30)", text: "rgb(59, 59, 59)" },
  dark: { window: "rgb(24, 24, 24)", panel: "rgb(31, 31, 31)", cardBorder: "rgb(37, 37, 37)", titleBar: "rgb(24, 24, 24)", titleBarText: "rgb(204, 204, 204)", text: "rgb(204, 204, 204)" }
};

test.describe("the empty window", () => {
  test("Noldova Desktop Sample starts with no module and shows the empty window @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await expect(window).toHaveTitle("Noldova Desktop Sample");
    await expect(window.locator("nol-panel-card")).toHaveCount(1);
    await expect(window.locator("nol-empty-window")).toHaveText(/Noldova Desktop Sample\s*No modules/);
    expect(await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
    await mainProcess.captureMainWindowAsync();
  });

  test("the window has no Node access and only the narrow bridge", async ({ mainProcess }) => {
    const globals = await mainProcess.window.evaluate(() => ({
      require: typeof globalThis.require,
      process: typeof globalThis.process,
      module: typeof globalThis.module,
      buffer: typeof globalThis.Buffer
    }));
    const bridge = await PageBridgeFixture.evaluateAsync(mainProcess.window, t => Object.keys(t).sort());

    expect({ ...globals, bridge }).toEqual({ require: "undefined", process: "undefined", module: "undefined", buffer: "undefined", bridge: [
      "actOnStartup", "actOnUpdate", "actOnWebView", "actOnWindow", "addToDictionary", "answerClose", "answerQuit", "answerUpdateSave", "appearance", "attachWebView", "chooseFilePath", "chooseFiles", "chooseFolder", "closeWebView", "copyDetails", "copyImage", "copyText",
      "edit", "findInWebView", "grantFiles", "installCommand", "keepAppearance", "keepSpelling", "logError", "logModule", "navigateWebView", "notifyAppearance", "notifyReady", "onCloseRequest", "onEvent", "onFieldMenu",
      "onFullScreen", "onMaximized", "onMenuCommand", "onNotificationOpened", "onQuitQuestion", "onStartup", "onTrayAvailable", "onUpdate", "onUpdateSaveRequest", "onWebViewEvent", "onWebViewInput", "onWebViewShortcut", "openFile", "openLink", "openLogFolder", "openWebView",
      "platform", "processor", "readBuild", "readFullScreen", "readLayout", "readMaximized", "readSpelling", "readStartup", "readTrayAvailable", "readUpdate", "releaseWebViewFocus", "replaceMisspelling", "request", "saveFile",
      "setAppShortcuts", "setMenuBar", "setWebViewShortcuts", "showInFolder", "writeLayout", "zoomWebView"
    ] });
  });

  test("an error the window throws and a rejection it leaves unhandled both go to the main process's log", async ({ mainProcess }) => {
    const log = (): Promise<string> => readFile(path.join(mainProcess.dataDirectory, "logs", "main.log"), "utf8");

    await mainProcess.window.evaluate(() => {
      setTimeout(() => {
        throw new Error("An error the window threw.");
      });
      void Promise.reject(new Error("A rejection the window left unhandled."));
    });

    await expect.poll(log).toMatch(/Window error: Error: An error the window threw\.\n/);
    await expect.poll(log).toMatch(/Window error: Error: A rejection the window left unhandled\.\n/);
    const text = await log();
    expect([text.split("Error: An error the window threw.").length, text.split("Error: A rejection the window left unhandled.").length]).toEqual([2, 2]);
    expect(mainProcess.acceptFailures(/the window threw\.|the window left unhandled\.|Window error: /).length).toBeGreaterThan(0);
  });

  test("an error that stops the window's bootstrap goes to the main process's log once", async ({ mainProcess }) => {
    const log = (): Promise<string> => readFile(path.join(mainProcess.dataDirectory, "logs", "main.log"), "utf8");
    await mainProcess.window.context().addInitScript(() => {
      globalThis.matchMedia = () => {
        throw new Error("The window's bootstrap stopped.");
      };
    });

    await mainProcess.window.reload();

    await expect.poll(log).toMatch(/Window error: Error: The window's bootstrap stopped\.\n/);
    await expect(mainProcess.window.locator("nol-empty-window")).toHaveCount(0);
    expect((await log()).split("Error: The window's bootstrap stopped.").length).toBe(2);
    expect(mainProcess.acceptFailures(/bootstrap stopped\.|Window error: /).length).toBeGreaterThan(0);
  });

  test("the window row, status bar and panel card follow the default theme", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-empty-window")).toBeVisible();
    await expect.poll(() => mainProcess.window.evaluate(() => {
      const card = document.querySelector("nol-panel-card");
      if (card === null)
        throw new Error("Nothing matches nol-panel-card.");
      return card.getBoundingClientRect().width;
    })).toBe(1920 - 8);
    const measured = await mainProcess.window.evaluate(() => {
      const style = (selector: string): CSSStyleDeclaration => {
        const element = document.querySelector(selector);
        if (element === null)
          throw new Error(`Nothing matches ${selector}.`);
        return getComputedStyle(element);
      };
      const bounds = (selector: string): DOMRect => {
        const element = document.querySelector(selector);
        if (element === null)
          throw new Error(`Nothing matches ${selector}.`);
        return element.getBoundingClientRect();
      };
      const row = style("nol-window-row");
      const bar = style("nol-status-bar");
      const side = style(".nol-status-bar-side");
      const card = style("nol-panel-card");
      const lookHeight = (name: string): string => {
        const probe = document.createElement("div");
        probe.style.height = `var(--nol-${name})`;
        document.body.append(probe);
        const height = getComputedStyle(probe).height;
        probe.remove();
        return height;
      };
      return {
        isDark: matchMedia("(prefers-color-scheme: dark)").matches,
        body: getComputedStyle(document.body).backgroundColor,
        rowLook: lookHeight("window-row-height"),
        barLook: lookHeight("status-bar-height"),
        row: { height: row.height, background: row.backgroundColor, color: row.color, borderBottom: row.borderBottomWidth },
        bar: { height: bar.height, paddingLeft: bar.paddingLeft, paddingRight: bar.paddingRight, gap: side.columnGap, background: bar.backgroundColor, borderTop: bar.borderTopWidth },
        card: { border: card.borderTopWidth, borderColor: card.borderTopColor, radius: card.borderTopLeftRadius, background: card.backgroundColor, color: card.color },
        cardBounds: (({ x, y, width, height, top, right, bottom, left }) => ({ x, y, width, height, top, right, bottom, left }))(bounds("nol-panel-card")),
        rowBottom: bounds("nol-window-row").bottom,
        barTop: bounds("nol-status-bar").top,
        viewport: [innerWidth, innerHeight]
      };
    });
    const expected = measured.isDark ? colors.dark : colors.light;

    expect(measured.body).toBe(expected.window);
    expect(measured.row).toEqual({ height: measured.rowLook, background: expected.titleBar, color: expected.titleBarText, borderBottom: "0px" });
    expect(measured.bar).toEqual({ height: measured.barLook, paddingLeft: "4px", paddingRight: "4px", gap: "4px", background: expected.window, borderTop: "0px" });
    expect(measured.card).toEqual({ border: "1px", borderColor: expected.cardBorder, radius: "8px", background: expected.panel, color: expected.text });
    expect(measured.cardBounds["x"]).toBe(4);
    expect(measured.cardBounds["y"]).toBe(measured.rowBottom);
    expect(measured.cardBounds["width"]).toBe(1920 - 8);
    expect(measured.cardBounds["bottom"]).toBe(measured.barTop - 4);
    expect(await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getBackgroundColor())).toBe(measured.isDark ? "#181818" : "#F8F8F8");
    await WindowModeFixture.expectStrongTextAsync(mainProcess.window, mainProcess.window.locator(".nol-empty-window-name"));
  });

  test("the window row leaves the native window controls their space, and on Linux ends with its own", async ({ mainProcess }) => {
    const row = await mainProcess.window.evaluate(() => {
      const element = document.querySelector<HTMLElement>("nol-window-row");
      if (element === null)
        throw new Error("Nothing matches nol-window-row.");
      const style = getComputedStyle(element);
      return {
        isMac: element.classList.contains("nol-window-row-mac"),
        left: Number.parseFloat(style.paddingLeft),
        right: Number.parseFloat(style.paddingRight),
        region: style.getPropertyValue("app-region"),
        isDrawn: element.querySelector("nol-window-controls") !== null
      };
    });

    expect(row.region).toBe("drag");
    if (process.platform === "darwin")
      expect(row).toMatchObject({ isMac: true, left: 78, right: 4, isDrawn: false });
    else if (process.platform === "linux")
      expect(row).toMatchObject({ isMac: false, left: 4, right: 0, isDrawn: true });
    else {
      expect(row).toMatchObject({ isMac: false, left: 4, isDrawn: false });
      expect(row.right).toBeGreaterThan(0);
    }
  });

  test("the window closes cleanly @smoke", async ({ mainProcess }) => {
    expect(await mainProcess.closeAsync()).toBe(0);
  });
});
