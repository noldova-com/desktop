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

test.use({ mainProcessVariant: BuildVariantFixture.noModules });

test("a window whose page stops asks with a native box, comes back when the person reloads it, and records why", async ({ mainProcess }) => {
  await mainProcess.stopTracingAsync();
  const window = mainProcess.window;
  await expect(window.locator("nol-empty-window")).toHaveText(/Noldova Desktop Sample\s*No modules/);
  await mainProcess.checkpointAsync("window-recovery-before");
  await mainProcess.application.evaluate(({ dialog }) => {
    const asked: string[] = [];
    globalThis.desktopAskedBoxes = asked;
    dialog.showMessageBox = (first: unknown, second?: unknown) => {
      const options = second ?? first;
      const message = typeof options === "object" && options !== null && "message" in options ? String(options.message) : "";
      const buttons = typeof options === "object" && options !== null && "buttons" in options && Array.isArray(options.buttons) ? options.buttons.map(String) : [];
      asked.push(`${message} ${buttons.join("/")}`);
      return Promise.resolve({ response: 0, checkboxChecked: false });
    };
  });

  const renderer = await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getOSProcessId() ?? 0);
  expect(renderer).toBeGreaterThan(0);
  process.kill(renderer, "SIGKILL");

  await expect.poll(() => mainProcess.application.evaluate(() => globalThis.desktopAskedBoxes))
    .toEqual(["Noldova Desktop Sample's window stopped unexpectedly. Reload/Quit"]);
  await expect.poll(() => mainProcess.application.evaluate(async ({ BrowserWindow }) => {
    const contents = BrowserWindow.getAllWindows()[0]?.webContents;
    if (contents === undefined || contents.isCrashed() || contents.isLoading())
      return "";
    return String(await contents.executeJavaScript("document.querySelector('nol-empty-window')?.textContent ?? ''"));
  })).toMatch(/Noldova Desktop Sample\s*No modules/);
  expect(await mainProcess.isVisibleAsync()).toBe(true);
  const log = await readFile(path.join(mainProcess.dataDirectory, "logs", "main.log"), "utf8");
  expect(log).toMatch(/^\S+ The window's page stopped: (?:crashed|killed|abnormal-exit), exit code -?\d+\.\n\S+ The person chose Reload\.\n$/);
  expect(mainProcess.acceptFailures(/^main: \S+ The (?:window's page stopped|person chose Reload)/)).toHaveLength(2);
});
