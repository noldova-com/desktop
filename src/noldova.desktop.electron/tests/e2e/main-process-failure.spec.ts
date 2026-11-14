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

test("an error the main process does not catch is logged with its stack and asks with Noldova Desktop Sample's own box, never Electron's", async ({ mainProcess }) => {
  await expect(mainProcess.window.locator("nol-empty-window")).toHaveText(/Noldova Desktop Sample\s*No modules/);
  await mainProcess.application.evaluate(({ app, dialog, shell }) => {
    const calls: string[] = [];
    const answers = [1, 0];
    globalThis.desktopFailureCalls = calls;
    dialog.showMessageBox = (first: unknown, second?: unknown) => {
      const options = second ?? first;
      const message = typeof options === "object" && options !== null && "message" in options ? String(options.message) : "";
      const buttons = typeof options === "object" && options !== null && "buttons" in options && Array.isArray(options.buttons) ? options.buttons.map(String) : [];
      calls.push(`box ${message} ${buttons.join("/")}`);
      return Promise.resolve({ response: answers.shift() ?? 2, checkboxChecked: false });
    };
    dialog.showErrorBox = (title: string) => calls.push(`error box ${title}`);
    shell.openPath = (folder: string) => {
      calls.push(`open ${folder}`);
      return Promise.resolve("");
    };
    app.relaunch = () => calls.push("relaunch");
    app.exit = (code?: number) => calls.push(`exit ${code}`);
  });

  await mainProcess.application.evaluate(() => {
    setImmediate(() => {
      throw new Error("A failure the test threw in the main process.");
    });
  });
  await expect.poll(() => mainProcess.application.evaluate(() => globalThis.desktopFailureCalls)).toEqual([
    "box Noldova Desktop Sample stopped because of an unexpected error. Restart Noldova Desktop Sample/Open log folder/Quit",
    `open ${path.join(mainProcess.dataDirectory, "logs")}`,
    "box Noldova Desktop Sample stopped because of an unexpected error. Restart Noldova Desktop Sample/Open log folder/Quit",
    "relaunch",
    "exit 0"
  ]);
  await mainProcess.checkpointAsync("main-process-failure-handled");
  await mainProcess.application.evaluate(() => {
    void Promise.reject(new Error("A rejection the test left unhandled in the main process."));
  });

  const logFile = path.join(mainProcess.dataDirectory, "logs", "main.log");
  await expect.poll(async () => await readFile(logFile, "utf8")).toContain("unhandled rejection: Error: A rejection the test left unhandled in the main process.\n    at ");
  const log = await readFile(logFile, "utf8");
  expect(log).toContain("The main process's main process failed with an uncaught exception: Error: A failure the test threw in the main process.\n    at ");
  expect(log).toMatch(/ The person chose Open log folder\.\n\S+ The person chose Restart Noldova Desktop Sample\.\n/);
  expect(await mainProcess.application.evaluate(() => globalThis.desktopFailureCalls)).toHaveLength(5);
  expect(mainProcess.acceptFailures(/^main: (?:\S+ (?:The main process's main process failed|The person chose)|at )/).length).toBeGreaterThanOrEqual(6);
});
