/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";

function readOverlay(): boolean | null {
  return navigator.windowControlsOverlay?.visible ?? null;
}

test.describe("the window controls", () => {
  test.skip(process.platform !== "win32", "Only Windows draws its window controls in a title bar overlay.");

  test("follow the window's appearance when the system switches between light and dark mode while the window is open", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await MediaFixture.emulateAsync(window, { colorScheme: "light" });
    await expect(window.locator("nol-window-row")).toBeVisible();
    await mainProcess.application.evaluate(({ BrowserWindow }) => {
      const overlays: unknown[] = [];
      const [target] = BrowserWindow.getAllWindows();
      const original = target?.setTitleBarOverlay.bind(target);
      globalThis.desktopOverlays = overlays;
      if (target !== undefined && original !== undefined)
        target.setTitleBarOverlay = options => {
          overlays.push(options);
          original(options);
        };
    });
    const readRow = (): Promise<{ color: string; symbolColor: string }> => window.locator("nol-window-row").evaluate(t => {
      const style = getComputedStyle(t);
      return { color: style.backgroundColor, symbolColor: style.color };
    });
    const lastOverlay = (): Promise<unknown> => mainProcess.application.evaluate(() => globalThis.desktopOverlays?.at(-1));
    const light = await readRow();

    await MediaFixture.emulateAsync(window, { colorScheme: "dark" });
    await expect.poll(readRow).not.toEqual(light);
    const dark = await readRow();

    await expect.poll(lastOverlay).toMatchObject(dark);
    await MediaFixture.emulateAsync(window, { colorScheme: "light" });
    await expect.poll(lastOverlay).toMatchObject(light);
    expect(await window.evaluate(readOverlay)).toBe(true);
    await mainProcess.checkpointAsync("window-controls");
  });
});

test.describe("the window's own controls on Linux", () => {
  test.skip(process.platform !== "linux", "Only Linux draws its window controls in the page, so that no system theme image is loaded for them.");

  test("replace the title bar overlay, end the row at the window's edge, and minimize, maximize, restore and close the window", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const controls = window.locator("nol-window-controls button");
    await expect(controls).toHaveCount(3);
    await mainProcess.application.evaluate(({ BrowserWindow }) => {
      const calls: string[] = [];
      const [target] = BrowserWindow.getAllWindows();
      globalThis.desktopWindowCalls = calls;
      if (target !== undefined) {
        const [isMaximized, minimize, maximize, unmaximize, close] = [target.isMaximized.bind(target), target.minimize.bind(target), target.maximize.bind(target), target.unmaximize.bind(target), target.close.bind(target)];
        globalThis.desktopWindowRestore = () => {
          target.isMaximized = isMaximized;
          target.minimize = minimize;
          target.maximize = maximize;
          target.unmaximize = unmaximize;
          target.close = close;
        };
        target.isMaximized = () => calls.at(-1) === "maximize";
        for (const name of ["minimize", "maximize", "unmaximize", "close"] as const)
          target[name] = () => calls.push(name);
      }
    });
    const calls = (): Promise<unknown> => mainProcess.application.evaluate(() => globalThis.desktopWindowCalls);
    const sendMaximized = (isMaximized: boolean): Promise<void> => mainProcess.application.evaluate(({ BrowserWindow }, value) => {
      BrowserWindow.getAllWindows()[0]?.emit(value ? "maximize" : "unmaximize");
    }, isMaximized);
    const geometry = await window.evaluate(() => {
      const rowElement = document.querySelector<HTMLElement>("nol-window-row");
      if (rowElement === null)
        throw new Error("Nothing matches nol-window-row.");
      const row = rowElement.getBoundingClientRect();
      const boxes = [...document.querySelectorAll("nol-window-controls button")].map(t => t.getBoundingClientRect());
      return { right: boxes.at(-1)?.right, tops: boxes.map(t => t.top - row.top), heights: boxes.map(t => t.height - row.height), width: innerWidth };
    });

    await controls.nth(0).click();
    await controls.nth(1).click();
    await sendMaximized(true);
    await expect(controls.nth(1)).toHaveAttribute("aria-label", "Restore");
    await controls.nth(1).click();
    await sendMaximized(false);
    await expect(controls.nth(1)).toHaveAttribute("aria-label", "Maximize");
    await mainProcess.checkpointAsync("window-controls-linux");
    await controls.nth(2).click();

    expect(await window.evaluate(readOverlay)).not.toBe(true);
    expect(geometry).toEqual({ right: geometry.width, tops: [0, 0, 0], heights: [0, 0, 0], width: geometry.width });
    await expect.poll(calls).toEqual(["minimize", "maximize", "unmaximize", "close"]);
    await mainProcess.application.evaluate(() => globalThis.desktopWindowRestore?.());
  });

  test("outline a hovered control dashed and a focused one solid in the system's highlight under forced colors, light and dark", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const controls = window.locator("nol-window-controls button");
    await expect(controls).toHaveCount(3);
    const read = (index: number): Promise<readonly string[]> => controls.nth(index).evaluate(t => {
      const style = getComputedStyle(t);
      return [style.outlineStyle, style.outlineColor, style.outlineWidth];
    });
    for (const colorScheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { forcedColors: "active", colorScheme });
      const highlight = await window.evaluate(() => {
        const probe = document.body.appendChild(document.createElement("span"));
        probe.style.color = "Highlight";
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved;
      });
      await controls.nth(2).hover();
      const hovered = await read(2);
      await window.mouse.move(1, 1);
      await controls.nth(1).focus();
      await window.keyboard.press("Shift+Tab");
      await window.keyboard.press("Tab");
      const focused = await read(1);

      expect([hovered.slice(0, 2), focused.slice(0, 2), parseFloat(focused[2] ?? "0") > parseFloat(hovered[2] ?? "0")]).toEqual([["dashed", highlight], ["solid", highlight], true]);
    }
    await mainProcess.checkpointAsync("window-controls-linux-forced-colors");
    await MediaFixture.emulateAsync(window, { colorScheme: null, forcedColors: null });
  });
});
