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
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";

import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test.describe("the programs modules run", () => {
  const startProgramAsync = async (dataDirectory: string, ...commandArguments: string[]): Promise<number[]> => {
    const executable = await readFile(path.resolve("_build", "development-app", "path.txt"), "utf8");
    const entry = path.resolve("node_modules", "@noldova", "desktop.cli", "services", "cli-entry.js");
    const commandLine = [entry, "run", "clock.startProgram", ...commandArguments, "--json", "--data-dir", dataDirectory];
    const { stdout } = await promisify(execFile)(executable, commandLine, { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 30_000 });
    const started = JsonReader.parse(stdout);
    return [started.readInteger("processId"), started.readInteger("childProcessId")];
  };

  const readSeen = (dataDirectory: string): number => {
    const database = new DatabaseSync(path.join(dataDirectory, "desktop.sqlite"), { readOnly: true, timeout: 5_000 });
    try {
      return Number(database.prepare("SELECT max(seen) AS seen FROM owned_processes").get()?.["seen"]);
    }
    finally {
      database.close();
    }
  };

  test("a runtime that ends abruptly leaves its programs running until the runtime that replaces it ends them @smoke", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const note = window.locator("nol-tab[data-tab-key=\"document/notes.note/2\"]");
    await expect(note).toBeVisible();
    const programs = await startProgramAsync(mainProcess.dataDirectory);
    const terminals = await startProgramAsync(mainProcess.dataDirectory, JSON.stringify("terminal"));
    const runtime = await mainProcess.readRuntimeProcessIdAsync() ?? 0;
    expect([...programs, ...terminals].every(t => MainProcessFixture.isAlive(t))).toBe(true);
    for (let renewal = 0; renewal < 2; renewal++) {
      const seen = readSeen(mainProcess.dataDirectory);
      await expect.poll(() => readSeen(mainProcess.dataDirectory) > seen, { timeout: 15_000 }).toBe(true);
    }

    mainProcess.acceptRuntimeEnds();
    process.kill(runtime, "SIGKILL");
    await expect.poll(() => MainProcessFixture.isAlive(runtime)).toBe(false);
    expect(MainProcessFixture.isAlive(programs[1] ?? 0)).toBe(true);

    await expect.poll(async () => {
      const replacement = await mainProcess.readRuntimeProcessIdAsync();
      return !Object.isUndefined(replacement) && replacement !== runtime && MainProcessFixture.isAlive(replacement);
    }, { timeout: 30_000 }).toBe(true);
    await expect.poll(() => [...programs, ...terminals].filter(t => MainProcessFixture.isAlive(t)), { timeout: 10_000 }).toEqual([]);
    await expect(note).toBeVisible();
    await mainProcess.checkpointAsync("programs-replacement-runtime");
    expect(await readFile(path.join(mainProcess.dataDirectory, "logs", "runtime.log"), "utf8")).toContain("An earlier runtime left processes");
  });
});
