/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Rectangle } from "electron";

import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";

test.use({ mainProcessVariant: BuildVariantFixture.noModules });

test.describe("window state", () => {
  const moved: Rectangle = { x: 40, y: 60, width: 900, height: 640 };
  const layout = { version: 1, probe: "window-state" };
  const readBounds = (mainProcess: MainProcessFixture): Promise<Rectangle | undefined> =>
    mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getNormalBounds());
  const readPlatform = (mainProcess: MainProcessFixture): Promise<string> =>
    mainProcess.application.evaluate(({ app }) => app.commandLine.getSwitchValue("ozone-platform"));
  const readFocus = async (mainProcess: MainProcessFixture): Promise<string> => {
    const window = await mainProcess.application.evaluate(({ BrowserWindow }) => {
      const shown = BrowserWindow.getAllWindows()[0];
      return `maximized ${shown?.isMaximized()}, focused ${shown?.isFocused()}`;
    });
    return `${window}, page focused ${await mainProcess.window.evaluate(() => document.hasFocus())}`;
  };
  const readLayout = (mainProcess: MainProcessFixture): Promise<unknown> =>
    PageBridgeFixture.evaluateAsync(mainProcess.window, t => t.readLayout());
  const openings: readonly [string, (mainProcess: MainProcessFixture) => Promise<void>][] = [
    ["quit and reopened", t => t.reopenAsync()],
    ["restarted after its runtime stopped", t => t.restartAsync()]
  ];

  test.describe("where the person left the window", () => {
    test.use({ mainProcessWindowPlacement: true });

    for (const [name, openAgainAsync] of openings)
      test(`Noldova Desktop Sample ${name} opens its window where the person left it @smoke`, async ({ mainProcess }) => {
        await expect(mainProcess.window.locator("nol-empty-window")).toBeVisible();
        test.skip(await readPlatform(mainProcess) === "wayland", "Under Wayland the compositor places each window it shows, and a window can't ask for its position.");
        await mainProcess.application.evaluate(({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0]?.setBounds(bounds), moved);
        await expect.poll(() => readBounds(mainProcess)).toEqual(moved);

        await openAgainAsync(mainProcess);

        await expect.poll(() => mainProcess.isVisibleAsync()).toBe(true);
        await expect.poll(() => readBounds(mainProcess)).toEqual(moved);
      });

    test("Noldova Desktop Sample quit and reopened with its window maximized opens it maximized and focused, so it takes keys without a click @smoke", async ({ mainProcess }) => {
      test.skip(process.platform === "linux", "The Linux workflows' display has no window manager to maximize a window.");
      await expect(mainProcess.window.locator("nol-empty-window")).toBeVisible();
      const first = await readFocus(mainProcess);
      await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.maximize());
      await expect.poll(() => readFocus(mainProcess)).toMatch(/^maximized true,/);

      await mainProcess.reopenAsync();

      await expect.poll(() => mainProcess.isVisibleAsync()).toBe(true);
      await expect.poll(async () => [first, await readFocus(mainProcess)])
        .toEqual(["maximized false, focused true, page focused true", "maximized true, focused true, page focused true"]);
    });
  });

  test("the window's layout outlives a restart, kept through the bridge", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-empty-window")).toBeVisible();
    expect(await readLayout(mainProcess)).toEqual({ payload: null });
    expect(await PageBridgeFixture.evaluateAsync(mainProcess.window, (t, value) => t.writeLayout(value), layout)).toEqual({ payload: null });

    await mainProcess.restartAsync();

    await expect(mainProcess.window.locator("nol-empty-window")).toBeVisible();
    expect(await readLayout(mainProcess)).toEqual({ payload: layout });
    await mainProcess.checkpointAsync("window-state-restarted");
  });
});
