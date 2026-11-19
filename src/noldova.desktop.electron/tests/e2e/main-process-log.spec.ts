/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { expect, test } from "@playwright/test";

import { MainProcessLogFixture } from "./fixtures/main-process-log.fixture.ts";

test.describe("the harness's reading of main-process failures from the main process log's file and its lines on the error output", () => {
  let folder: string;
  let file: string;

  test.beforeEach(async () => {
    folder = await mkdtemp(path.join(os.tmpdir(), "desktop-main-process-log-"));
    file = path.join(folder, "main.log");
  });

  test.afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  test("a log that cannot be read says so with its error code and reads the error output alone", async () => {
    expect(await MainProcessLogFixture.describeMainProcessFailuresAsync(file, [
      "2026-10-05T20:00:01.000Z The main process's main process failed with an uncaught exception: Error: Written.",
      "at written (main.js:1:1)"
    ])).toBe([
      "The main process log could not be read (ENOENT), so only its lines on the main process's error output were read.",
      "The main process log shows this main-process failure:",
      "2026-10-05T20:00:01.000Z The main process's main process failed with an uncaught exception: Error: Written.",
      "    at written (main.js:1:1)"
    ].join("\n"));
  });

  test("a log and output without a main-process failure say so, even when another entry's stack mentions one", async () => {
    await writeFile(file, [
      "2026-10-05T20:00:00.000Z The main process started.",
      "2026-10-05T20:00:01.000Z A module failed: Error: The main process's main process failed in a message.",
      "    at run (module.js:1:1)",
      String.empty
    ].join("\n"));

    expect(await MainProcessLogFixture.describeMainProcessFailuresAsync(file, [
      "2026-10-05T20:00:02.000Z A module failed: Error: The main process's main process failed in a message.",
      "at run (module.js:1:1)"
    ])).toBe("The main process log shows no main-process failure.");
  });

  test("output before the first entry belongs to no entry", async () => {
    await writeFile(file, String.empty);

    expect(await MainProcessLogFixture.describeMainProcessFailuresAsync(file, [
      "The main process's main process failed with an uncaught exception: Error: Not an entry.",
      "at early (main.js:1:1)"
    ])).toBe("The main process log shows no main-process failure.");
  });

  test("each main-process failure is given whole with its stack, and only those entries", async () => {
    await writeFile(file, [
      "2026-10-05T20:00:00.000Z The main process started.",
      "2026-10-05T20:00:01.000Z The main process's main process failed with an uncaught exception: Error: First.",
      "    at first (main.js:1:1)",
      "2026-10-05T20:00:02.000Z The person chose Restart Noldova Desktop Sample.",
      "2026-10-05T20:00:03.000Z The main process could not ask what to do after its main process failed, so it quits: Error: No box.",
      "    at box (main.js:2:2)",
      String.empty
    ].join("\n"));

    expect(await MainProcessLogFixture.describeMainProcessFailuresAsync(file, [])).toBe([
      "The main process log shows these main-process failures:",
      "2026-10-05T20:00:01.000Z The main process's main process failed with an uncaught exception: Error: First.",
      "    at first (main.js:1:1)",
      "2026-10-05T20:00:03.000Z The main process could not ask what to do after its main process failed, so it quits: Error: No box.",
      "    at box (main.js:2:2)"
    ].join("\n"));
  });

  test("a failure only the file holds, one only the output holds and one both hold are each given once, in the order they were logged", async () => {
    await writeFile(file, [
      "2026-10-05T20:00:01.000Z The main process's main process failed with an uncaught exception: Error: Before the output was read.",
      "    at early (main.js:1:1)",
      "2026-10-05T20:00:03.000Z The main process's main process failed with an uncaught exception: Error: Both.",
      "    at both (main.js:3:3)",
      String.empty
    ].join("\n"));

    expect(await MainProcessLogFixture.describeMainProcessFailuresAsync(file, [
      "2026-10-05T20:00:03.000Z The main process's main process failed with an uncaught exception: Error: Both.",
      "at both (main.js:3:3)",
      "2026-10-05T20:00:04.000Z The main process's main process failed with an uncaught exception: Error: Before the file took it.",
      "at late (main.js:4:4)"
    ])).toBe([
      "The main process log shows these main-process failures:",
      "2026-10-05T20:00:01.000Z The main process's main process failed with an uncaught exception: Error: Before the output was read.",
      "    at early (main.js:1:1)",
      "2026-10-05T20:00:03.000Z The main process's main process failed with an uncaught exception: Error: Both.",
      "    at both (main.js:3:3)",
      "2026-10-05T20:00:04.000Z The main process's main process failed with an uncaught exception: Error: Before the file took it.",
      "    at late (main.js:4:4)"
    ].join("\n"));
  });
});
