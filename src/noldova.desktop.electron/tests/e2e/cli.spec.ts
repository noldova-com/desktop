/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { ErrorCodeFixture } from "./fixtures/error-code.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { SettingsFixture } from "./fixtures/settings.fixture.ts";

test.describe("the command line", () => {
  const entry = path.resolve("node_modules", "@noldova", "desktop.cli", "services", "cli-entry.js");

  const runAsync = async (commandLine: readonly string[]): Promise<{ code: number; output: string; error: string }> => {
    const executable = await readFile(path.resolve("_build", "development-app", "path.txt"), "utf8");
    try {
      const { stdout, stderr } = await promisify(execFile)(executable, [entry, ...commandLine], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 30_000 });
      return { code: 0, output: stdout, error: stderr };
    }
    catch (error) {
      const code = ErrorCodeFixture.codeOf(error);
      return { code: Object.isNumber(code) ? code : Number.NaN, output: ErrorCodeFixture.stdoutOf(error) ?? String.empty, error: ErrorCodeFixture.stderrOf(error) ?? ErrorCodeFixture.messageOf(error) };
    }
  };

  test("reports the modules of the runtime the open window uses and runs its commands", async ({ mainProcess }) => {
    const status = await runAsync(["status", "--json", "--data-dir", mainProcess.dataDirectory]);
    const tick = await runAsync(["run", "clock.tick", "--json", "--data-dir", mainProcess.dataDirectory]);

    expect(status.code, status.error).toBe(0);
    const report = JsonReader.parse(status.output);
    expect(report.readString("dataDirectory")).toBe(mainProcess.dataDirectory);
    expect(report.readValue("modules")).toEqual(expect.arrayContaining([{ id: "clock", state: "Active" }, { id: "notes", state: "Active" }]));
    expect(tick.code, tick.error).toBe(0);
    expect(JsonReader.parse(tick.output).toJson()).toEqual({ ticks: 1 });
    expect(await mainProcess.readRuntimeProcessIdAsync()).toBeGreaterThan(0);
    await mainProcess.checkpointAsync("cli-window");
  });

  test("runs a module's own command through its command-line part and prints its help", async ({ mainProcess }) => {
    const text = await runAsync(["clock", "show-time", "--prefix", "Now", "--data-dir", mainProcess.dataDirectory]);
    const json = await runAsync(["clock", "show-time", "--json", "--data-dir", mainProcess.dataDirectory]);
    const help = await runAsync(["help", "clock", "show-time"]);
    const unknown = await runAsync(["clock", "rewind", "--data-dir", mainProcess.dataDirectory]);

    expect(text.code, text.error).toBe(0);
    expect(text.output).toMatch(/^Now \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\.\r?\n$/);
    expect(json.code, json.error).toBe(0);
    expect(Date.parse(JsonReader.parse(json.output).readString("time"))).not.toBeNaN();
    expect(help.code, help.error).toBe(0);
    expect(help.output).toContain("Usage: noldova-desktop clock show-time [--prefix <text>]");
    expect(help.output).toContain("--prefix <text>  The words before the time. Default: \"It is\".");
    expect(unknown.code).toBe(2);
    expect(unknown.error).toContain("\"rewind\" is not a command of clock.");
  });

  test("refuses an off module's commands with the setting that turns it on, and reports it off and its dependent blocked", async ({ mainProcess }) => {
    await SettingsFixture.openPageAsync(mainProcess.window, "Clock");
    await mainProcess.window.locator("nol-settings").getByRole("checkbox", { name: "Runs the clock and the modules that need it." }).click();
    await expect(mainProcess.window.locator("nol-module-failure-card")).toHaveText(/Clock is off/);

    const time = await runAsync(["clock", "show-time", "--json", "--data-dir", mainProcess.dataDirectory]);
    const status = await runAsync(["status", "--json", "--data-dir", mainProcess.dataDirectory]);

    expect(time.code, time.error).toBe(7);
    expect(JsonReader.parse(time.error).toJson()).toEqual(expect.objectContaining({ code: "ModuleNotActive", details: { module: "clock", cause: "It is off; the setting clock.enabled turns it on." } }));
    expect(status.code, status.error).toBe(0);
    expect(JsonReader.parse(status.output).readValue("modules")).toEqual(expect.arrayContaining([
      { id: "clock", state: "Off" },
      { id: "alarm", state: "Blocked", cause: "It depends on clock, which is off." }
    ]));
  });
});
