/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { CliFixture } from "./fixtures/cli.fixture.ts";
import { ClockWorkFixture } from "./fixtures/clock-work.fixture.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";

async function quitAsync(mainProcess: MainProcessFixture): Promise<void> {
  await mainProcess.application.evaluate(({ app }) => app.quit());
}

async function waitForExitAsync(mainProcess: MainProcessFixture): Promise<number | null> {
  const child = mainProcess.application.process();
  return await new Promise<number | null>(resolve => {
    if (!Object.isNull(child.exitCode))
      resolve(child.exitCode);
    else
      child.once("exit", resolve);
  });
}

test.describe("quitting while a module works", () => {
  const startProgramAsync = async (dataDirectory: string): Promise<number[]> => {
    const started = JsonReader.parse(await CliFixture.runAsync("run", "clock.startProgram", "--json", "--data-dir", dataDirectory));
    return [started.readInteger("processId"), started.readInteger("childProcessId")];
  };

  test("asks before quitting, stays open when the person cancels and quits once the work they waited for finishes @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await ClockWorkFixture.beginAsync(mainProcess);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    await quitAsync(mainProcess);
    await expect(asking).toBeVisible();
    await expect(asking.getByRole("listitem")).toHaveText([ClockWorkFixture.WORK]);
    await expect(asking.getByRole("button", { name: "Wait, then quit" })).toBeFocused();
    await expect(asking.locator(".nol-dialog-actions").getByRole("button")).toHaveText(["Wait, then quit", "Stop the work and quit", "Cancel"]);
    await expect(asking.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    const box = await window.locator("nol-dialog").boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(440);
    expect(await window.locator(".nol-dialog-backdrop").evaluate(t => getComputedStyle(t).backgroundColor)).toBe("rgba(0, 0, 0, 0.5)");
    await mainProcess.checkpointAsync("quit-asking");
    await window.keyboard.press("Escape");
    await expect(asking).toHaveCount(0);
    expect(await mainProcess.isVisibleAsync()).toBe(true);

    await quitAsync(mainProcess);
    await asking.getByRole("button", { name: "Wait, then quit" }).click();
    const waiting = window.getByRole("dialog", { name: "Waiting for the work to finish" });
    await expect(waiting).toBeVisible();
    await expect(waiting.getByRole("button", { name: "Cancel" })).toBeFocused();
    await expect(waiting.locator(".nol-dialog-actions").getByRole("button")).toHaveText(["Stop the work and quit", "Cancel"]);
    await expect(waiting.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await mainProcess.checkpointAsync("quit-waiting");
    const exited = waitForExitAsync(mainProcess);
    await ClockWorkFixture.finishAsync(mainProcess.dataDirectory);

    expect(await exited).toBe(0);
    expect(existsSync(path.join(mainProcess.dataDirectory, "work", "clock", "stopped"))).toBe(false);
  });

  test("keeps the focus in the question on F10 or a lone Alt with the window behind it inert, and F10 reaches the menus again once the person cancels", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const content = window.locator("nol-window");
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await ClockWorkFixture.beginAsync(mainProcess);
    const asking = window.getByRole("dialog", { name: "Work is still running" });
    const wait = asking.getByRole("button", { name: "Wait, then quit" });

    await quitAsync(mainProcess);
    await expect(wait).toBeFocused();
    await window.keyboard.press("F10");
    await expect(wait).toBeFocused();
    await window.keyboard.press("Alt");
    await expect(wait).toBeFocused();
    expect(await content.evaluate(t => [t instanceof HTMLElement ? t.inert : null, t.getAttribute("aria-hidden")])).toEqual([true, "true"]);
    await window.keyboard.press("Tab");
    expect(await asking.evaluate(t => t.contains(document.activeElement) && document.activeElement !== t)).toBe(true);
    await window.keyboard.press("Escape");
    await expect(asking).toHaveCount(0);

    expect(await content.evaluate(t => [t instanceof HTMLElement ? t.inert : null, t.getAttribute("aria-hidden")])).toEqual([false, null]);
    if (process.platform !== "darwin") {
      await window.keyboard.press("F10");
      await expect(window.locator("nol-menu-bar").getByRole("menuitem").first()).toBeFocused();
    }
    await ClockWorkFixture.finishAsync(mainProcess.dataDirectory);
    await expect.poll(() => ClockWorkFixture.readAsync(mainProcess.dataDirectory), { timeout: ClockWorkFixture.TIMEOUT, intervals: [ClockWorkFixture.INTERVAL] }).toEqual([]);
  });

  test("paints the question's body in the dialog's text color at full opacity as it opens, without a pointer move, in light and in dark mode", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await ClockWorkFixture.beginAsync(mainProcess);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    for (const scheme of ["light", "dark"] as const) {
      await MediaFixture.emulateAsync(window, { colorScheme: scheme });
      await expect.poll(() => window.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(scheme);
      await quitAsync(mainProcess);
      await expect(asking).toBeVisible();
      await expect(asking.locator(".nol-quit-text")).toHaveText(["Noldova Desktop Sample is still working on:", "Wait for it to finish, or stop it now."]);

      const painted = await asking.locator("nol-dialog").evaluate(dialog => {
        const lines = [...dialog.querySelectorAll<HTMLElement>(".nol-quit-text, .nol-quit-list li")];
        const opacity = (element: HTMLElement): number => {
          let value = 1;
          for (let node: HTMLElement | null = element; node !== null; node = node.parentElement)
            value *= Number(getComputedStyle(node).opacity);
          return value;
        };
        return { dialog: getComputedStyle(dialog).color, colors: [...new Set(lines.map(t => getComputedStyle(t).color))], opacities: [...new Set(lines.map(opacity))] };
      });
      expect(painted.dialog).not.toBe("rgba(0, 0, 0, 0)");
      expect(painted.colors).toEqual([painted.dialog]);
      expect(painted.opacities).toEqual([1]);
      await mainProcess.checkpointAsync(`quit-asking-${scheme}`);
      await window.keyboard.press("Escape");
      await expect(asking).toHaveCount(0);
    }
    await ClockWorkFixture.finishAsync(mainProcess.dataDirectory);
    await expect.poll(() => ClockWorkFixture.readAsync(mainProcess.dataDirectory), { timeout: ClockWorkFixture.TIMEOUT, intervals: [ClockWorkFixture.INTERVAL] }).toEqual([]);
  });

  test("quits from the command line as its Quit does, which says Noldova Desktop Sample stayed open when the person cancels and that it quit once the work they waited for finishes", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    await ClockWorkFixture.beginAsync(mainProcess);
    const asking = window.getByRole("dialog", { name: "Work is still running" });

    const cancelled = CliFixture.runToEndAsync("quit", "--data-dir", mainProcess.dataDirectory);
    await expect(asking).toBeVisible();
    await window.keyboard.press("Escape");
    expect(await cancelled).toEqual({ code: 6, output: String.empty, error: "Noldova Desktop Sample stayed open: it was kept open while work was in progress.\n" });
    expect(await mainProcess.isVisibleAsync()).toBe(true);

    const quitting = CliFixture.runToEndAsync("quit", "--json", "--data-dir", mainProcess.dataDirectory);
    await asking.getByRole("button", { name: "Wait, then quit" }).click();
    const exited = waitForExitAsync(mainProcess);
    await ClockWorkFixture.finishAsync(mainProcess.dataDirectory);

    expect(await exited).toBe(0);
    expect(await quitting).toEqual({ code: 0, output: "{\"outcome\":\"Quit\"}\n", error: String.empty });
  });

  test("stops the work and quits when the person chooses to, and the runtime stops with it and ends the programs its modules run @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await expect(window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]")).toBeVisible();
    const programs = await startProgramAsync(mainProcess.dataDirectory);
    expect(programs.every(t => MainProcessFixture.isAlive(t))).toBe(true);
    await ClockWorkFixture.beginAsync(mainProcess);
    const runtime = await mainProcess.readRuntimeProcessIdAsync() ?? 0;

    await quitAsync(mainProcess);
    const exited = waitForExitAsync(mainProcess);
    await window.getByRole("dialog", { name: "Work is still running" }).getByRole("button", { name: "Stop the work and quit" }).click();

    expect(await exited).toBe(0);
    await expect.poll(() => MainProcessFixture.isAlive(runtime), { timeout: 30_000 }).toBe(false);
    await expect.poll(() => programs.filter(t => MainProcessFixture.isAlive(t)), { timeout: 5_000 }).toEqual([]);
    expect(existsSync(path.join(mainProcess.dataDirectory, "work", "clock", "stopped"))).toBe(true);
    expect(await readFile(path.join(mainProcess.dataDirectory, "logs", "runtime.log"), "utf8")).toContain("clock: The clock began counting.\n");
  });
});

test.describe("saving before quitting", () => {
  const readMainProcessLogAsync = async (mainProcess: MainProcessFixture): Promise<string> =>
    await readFile(path.join(mainProcess.dataDirectory, "logs", "main.log"), "utf8");

  test("stays open with the error naming the module when a window part's save fails, and quits once it saves @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]").click();
    await window.locator("[data-fixture-content=notes-save-fails]:visible").click();
    const toast = window.locator(".nol-toast", { hasText: "Notes couldn't save, so Noldova Desktop Sample stayed open" });

    await quitAsync(mainProcess);

    await expect(toast).toBeVisible();
    await expect(toast.locator(".nol-toast-text")).toHaveText("The disk is full.");
    await expect(toast).toHaveAttribute("data-severity", "Error");
    await expect(toast.locator(".nol-toast-meta")).toContainText("Noldova Desktop Sample");
    expect(await mainProcess.isVisibleAsync()).toBe(true);
    await expect.poll(() => readMainProcessLogAsync(mainProcess)).toMatch(/Window error in notes: WindowPartSaveFailedException: Its window part failed to save while Noldova Desktop Sample was closing\.\n/);
    await mainProcess.checkpointAsync("quit-save-failed");
    await window.locator("[data-fixture-content=notes-save-saves]:visible").click();
    const exited = waitForExitAsync(mainProcess);
    await quitAsync(mainProcess);

    expect(await exited).toBe(0);
    expect(mainProcess.acceptFailures(/Window error in notes: |^renderer: ERROR WindowPartSaveFailedException: Its window part failed to save while Noldova Desktop Sample was closing\./).length).toBeGreaterThan(0);
  });

  test("quits after 4 seconds without a window part whose save never settles, and logs a warning naming the module", async ({ mainProcess }) => {
    const window = mainProcess.window;
    await window.locator("nol-tab[data-tab-key=\"document/notes.note/1\"]").click();
    await window.locator("[data-fixture-content=notes-save-hangs]:visible").click();
    const exited = waitForExitAsync(mainProcess);
    const started = Date.now();

    await quitAsync(mainProcess);

    expect(await exited).toBe(0);
    expect(Date.now() - started, "a timing lower bound: the quit waits out the 4 s save limit before it closes; a busy machine only lengthens it").toBeGreaterThanOrEqual(4000);
    expect(await readMainProcessLogAsync(mainProcess)).toContain(
      "Window error in notes: Its window part did not finish saving within 4 seconds while Noldova Desktop Sample was closing; Noldova Desktop Sample closed without it.");
    expect(mainProcess.acceptFailures(/Window error in notes: Its window part did not finish saving within 4 seconds/).length).toBeGreaterThan(0);
  });
});
