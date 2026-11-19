/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { expect, test } from "@playwright/test";

import { MainProcessLogFixture } from "./fixtures/main-process-log.fixture.ts";

test.describe("the harness's reading of main-process failures from the main process log's lines on its error output", () => {
  test("no lines say there is no failure", () => {
    expect(MainProcessLogFixture.describeMainProcessFailures([])).toBe("The main process log shows no main-process failure.");
  });

  test("lines without a main-process failure say so, even when another entry's stack mentions one", () => {
    expect(MainProcessLogFixture.describeMainProcessFailures([
      "2026-10-05T20:00:00.000Z The main process started.",
      "2026-10-05T20:00:01.000Z A module failed: Error: The main process's main process failed in a message.",
      "at run (module.js:1:1)"
    ])).toBe("The main process log shows no main-process failure.");
  });

  test("lines before the first entry belong to no entry", () => {
    expect(MainProcessLogFixture.describeMainProcessFailures([
      "The main process's main process failed with an uncaught exception: Error: Not an entry.",
      "at early (main.js:1:1)"
    ])).toBe("The main process log shows no main-process failure.");
  });

  test("each main-process failure is given whole with its stack indented as the log writes it, and only those entries", () => {
    expect(MainProcessLogFixture.describeMainProcessFailures([
      "2026-10-05T20:00:00.000Z The main process started.",
      "2026-10-05T20:00:01.000Z The main process's main process failed with an uncaught exception: Error: First.",
      "at first (main.js:1:1)",
      "2026-10-05T20:00:02.000Z The person chose Restart Noldova Desktop Sample.",
      "2026-10-05T20:00:03.000Z The main process could not ask what to do after its main process failed, so it quits: Error: No box.",
      "at box (main.js:2:2)"
    ])).toBe([
      "The main process log shows these main-process failures:",
      "2026-10-05T20:00:01.000Z The main process's main process failed with an uncaught exception: Error: First.",
      "    at first (main.js:1:1)",
      "2026-10-05T20:00:03.000Z The main process could not ask what to do after its main process failed, so it quits: Error: No box.",
      "    at box (main.js:2:2)"
    ].join("\n"));
  });
});
