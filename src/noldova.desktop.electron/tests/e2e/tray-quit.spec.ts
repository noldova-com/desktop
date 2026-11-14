/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { CliFixture } from "./fixtures/cli.fixture.ts";
import { ClockWorkFixture } from "./fixtures/clock-work.fixture.ts";
import { installedElectron } from "./fixtures/installed-electron.fixture.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { OffCursorPlacement } from "./fixtures/off-cursor-placement.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { SessionBusFixture } from "./fixtures/session-bus.fixture.ts";

const HINT_REFUSED: RegExp = /The operating system did not show the hint that Noldova Desktop Sample is still running/;
const PLAYWRIGHT_DEBUGGING: RegExp = /^--(inspect|remote-debugging-port)=/;
const NO_TRAY_HOST: string = "The session has no tray host, which Linux has only with a StatusNotifier host, so the last window's close quits.";

async function keepsRunningAsync(mainProcess: MainProcessFixture): Promise<boolean> {
  if (process.platform === "darwin")
    return true;
  const hasTrayHost = await SessionBusFixture.hasTrayHostAsync();
  expect(await PageBridgeFixture.evaluateAsync(mainProcess.window, t => t.readTrayAvailable()), "The main process reports a tray exactly where the system has a tray host.").toBe(hasTrayHost);
  return hasTrayHost;
}

async function closeIntoTheTrayAsync(mainProcess: MainProcessFixture): Promise<string> {
  const hints = path.join(mainProcess.root, "device", "device-state.json");
  const expected = process.platform === "darwin" ? "none" : await SessionBusFixture.hasNotificationsAsync() ? "shown" : "refused";
  await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
  await expect.poll(() => mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(0);
  if (expected === "none")
    return expected;
  await expect.poll(() => existsSync(hints) ? "shown" : mainProcess.failures.some(t => HINT_REFUSED.test(t)) ? "refused" : String.empty).toBe(expected);
  mainProcess.acceptFailures(HINT_REFUSED);
  return expected;
}

async function readAppIdAsync(mainProcess: MainProcessFixture): Promise<string> {
  const launch = await mainProcess.application.evaluate(({ app }) => ({ isPackaged: app.isPackaged && process.defaultApp !== true, executablePath: process.execPath, argv: process.argv, workingDirectory: process.cwd() }));
  const script = path.resolve("node_modules", "@noldova", "desktop.electron", "main.js");
  return (await installedElectron.TaskbarIdentity.createAsync(launch.isPackaged, launch.executablePath, launch.executablePath, script, launch.argv, launch.workingDirectory)).appId;
}

async function countToastsAsync(appId: string): Promise<number> {
  const { stdout } = await promisify(execFile)("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
    "$null = [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]; " +
    `@([Windows.UI.Notifications.ToastNotificationManager]::History.GetHistory('${appId}')).Count`], { encoding: "utf8", windowsHide: true, timeout: 30_000 });
  return Number(stdout.trim());
}

async function startAgainAsync(mainProcess: MainProcessFixture): Promise<void> {
  const launch = await mainProcess.application.evaluate(() => ({ executablePath: process.execPath, argv: process.argv, workingDirectory: process.cwd(), environment: process.env }));
  const args = launch.argv.slice(1).filter(t => !PLAYWRIGHT_DEBUGGING.test(t));
  expect(args.includes(path.resolve("_build", "development-package")), `Noldova Desktop Sample's arguments name its development package: ${JSON.stringify(launch.argv)}`).toBe(true);
  const second = spawn(launch.executablePath, args, { cwd: launch.workingDirectory, env: launch.environment, stdio: ["ignore", "ignore", "pipe"] });
  let errors = String.empty;
  second.stderr?.setEncoding("utf8").on("data", (t: string) => errors += t);
  const ended = await new Promise<[number | null, string | null]>(resolve => second.once("close", (code, signal) => resolve([code, signal])));
  expect(ended, `The second start ended with ${JSON.stringify(ended)} and wrote: ${errors}`).toEqual([0, null]);
}

async function moveOffCursorAsync(mainProcess: MainProcessFixture): Promise<void> {
  const state = await mainProcess.application.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows()[0];
    return window === undefined ? null : { cursor: screen.getCursorScreenPoint(), bounds: window.getBounds(), displays: screen.getAllDisplays().map(t => t.bounds) };
  });
  if (Object.isNull(state))
    return;
  const placed = await OffCursorPlacement.placeAsync(state.bounds, state.cursor, state.displays, target => mainProcess.application.evaluate(({ BrowserWindow }, next) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window === undefined)
      throw new Error("The window is gone.");
    window.setBounds(next);
    return window.getBounds();
  }, target), OffCursorPlacement.isFittingOnly(process.platform, process.env));
  await expect.poll(() => mainProcess.isCursorInsideAsync(), {
    message: `The window ${OffCursorPlacement.describe(state.bounds)} was moved to ${OffCursorPlacement.describe(placed)}, off the cursor at ${state.cursor.x},${state.cursor.y}, ` +
      `and the cursor stayed inside it. Displays: ${state.displays.map(t => OffCursorPlacement.describe(t)).join("; ")}.`
  }).toBe(false);
}

test.describe("closing and quitting beside the tray icon", () => {
  test("keeps running behind the tray icon or the macOS menu bar when the last window closes, quits there without one, and a quit ends every Noldova Desktop Sample process and leaves no hint in Windows' notifications", async ({ mainProcess }) => {
    const started = JsonReader.parse(await CliFixture.runAsync("run", "clock.startProgram", "--json", "--data-dir", mainProcess.dataDirectory));
    const programs = [started.readInteger("processId"), started.readInteger("childProcessId")];
    const runtime = await mainProcess.readRuntimeProcessIdAsync() ?? 0;
    const child = mainProcess.application.process();
    const exited = new Promise<number | null>(resolve => child.once("exit", resolve));
    const hints = path.join(mainProcess.root, "device", "device-state.json");
    const keepsRunning = await keepsRunningAsync(mainProcess);
    const appId = process.platform === "win32" ? await readAppIdAsync(mainProcess) : null;
    const toasts = Object.isNull(appId) ? 0 : await countToastsAsync(appId);
    await mainProcess.checkpointAsync("tray-quit-before-closing");

    if (keepsRunning) {
      const outcome = await closeIntoTheTrayAsync(mainProcess);
      if (outcome === "shown")
        expect(JsonReader.parse(await readFile(hints, "utf8")).toJson()).toEqual({ trayCloseHintShown: true });
      else
        expect(existsSync(hints)).toBe(false);
      if (!Object.isNull(appId))
        await expect.poll(() => countToastsAsync(appId)).toBe(toasts + 1);
      expect(child.exitCode).toBeNull();
      expect(programs.every(t => MainProcessFixture.isAlive(t))).toBe(true);
      await mainProcess.application.evaluate(({ app }) => app.quit());
    }
    else
      await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());

    expect(await exited).toBe(0);
    await expect.poll(() => MainProcessFixture.isAlive(runtime), { timeout: 30_000 }).toBe(false);
    await expect.poll(() => programs.filter(t => MainProcessFixture.isAlive(t)), { timeout: 5_000 }).toEqual([]);
    if (!Object.isNull(appId))
      await expect.poll(() => countToastsAsync(appId), { message: "The hint that Noldova Desktop Sample is still running stayed in Windows' notifications after it quit.", timeout: 5_000 }).toBe(toasts);
  });

  test("a second start while Noldova Desktop Sample runs without a window opens one window and exits", async ({ mainProcess }) => {
    test.skip(!await keepsRunningAsync(mainProcess), NO_TRAY_HOST);
    await closeIntoTheTrayAsync(mainProcess);
    const reopened = mainProcess.application.waitForEvent("window");

    await startAgainAsync(mainProcess);
    await expect((await reopened).locator("nol-window")).toBeVisible();
    await moveOffCursorAsync(mainProcess);
    await startAgainAsync(mainProcess);

    expect(await mainProcess.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  });

  test("a quit with work running and no window asks in a new window and quits once the person stops the work", async ({ mainProcess }) => {
    test.skip(!await keepsRunningAsync(mainProcess), NO_TRAY_HOST);
    await expect(mainProcess.window.locator("nol-window")).toBeVisible();
    await ClockWorkFixture.beginAsync(mainProcess);
    await closeIntoTheTrayAsync(mainProcess);
    const asking = mainProcess.application.waitForEvent("window");
    const child = mainProcess.application.process();
    const exited = new Promise<number | null>(resolve => child.once("exit", resolve));

    await mainProcess.application.evaluate(({ app }) => app.quit());
    const question = (await asking).getByRole("dialog", { name: "Work is still running" });
    await expect(question.getByRole("listitem")).toHaveText([ClockWorkFixture.WORK]);
    await question.getByRole("button", { name: "Stop the work and quit" }).click();

    expect(await exited).toBe(0);
    expect(existsSync(path.join(mainProcess.dataDirectory, "work", "clock", "stopped"))).toBe(true);
  });
});
