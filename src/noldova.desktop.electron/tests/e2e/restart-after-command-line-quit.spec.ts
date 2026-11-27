/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { CliFixture } from "./fixtures/cli.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test("Noldova Desktop Sample quit from the command line and started again at once reaches its runtime", async ({ mainProcess }, testInfo) => {
  const logs = path.join(mainProcess.dataDirectory, "logs");
  const attachAsync = async (name: string): Promise<void> => {
    const body = await readFile(path.join(logs, name), "utf8").catch((error: unknown) => `unread: ${String(error)}`);
    await testInfo.attach(name, { body, contentType: "text/plain" });
    console.log(`----- ${name}\n${body}`);
  };
  const notes: string[] = [];
  try {
    notes.push(`runtime before: ${await mainProcess.readRuntimeProcessIdAsync()}`);
    const quit = await CliFixture.runToEndAsync("quit", "--json", "--timeout", "30", "--data-dir", mainProcess.dataDirectory);
    notes.push(`quit: ${JSON.stringify(quit)} at ${new Date().toISOString()}`);
    notes.push(`runtime after quit: ${await mainProcess.readRuntimeProcessIdAsync()}`);
    const exitCode = await mainProcess.startAfterExitAsync();
    notes.push(`exit code: ${exitCode}, started again at ${new Date().toISOString()}`);
    notes.push(`runtime after start: ${await mainProcess.readRuntimeProcessIdAsync()}`);
    expect(quit.output).toBe("{\"outcome\":\"Quit\"}\n");
    expect(exitCode).toBe(0);
    expect(await mainProcess.isVisibleAsync()).toBe(true);
  }
  finally {
    await testInfo.attach("notes", { body: notes.join("\n"), contentType: "text/plain" });
    console.log(`----- notes\n${notes.join("\n")}`);
    await attachAsync("runtime.log");
    await attachAsync("runtime.previous.log");
    await attachAsync("main.log");
  }
});
