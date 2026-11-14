/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import type { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";

test.describe("module data", () => {
  const recordAsync = async (mainProcess: MainProcessFixture): Promise<number> => {
    return (await PageBridgeFixture.answerAsync(mainProcess.window, "clock.record", null)).readObject("payload").readNumber("readings");
  };

  test("a module's own database keeps its records across a restart of Noldova Desktop Sample and its runtime", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("[data-fixture-content=clock-face]")).toBeVisible();

    const before = await recordAsync(mainProcess);
    await mainProcess.restartAsync();
    await expect(mainProcess.window.locator("[data-fixture-content=clock-face]")).toBeVisible();
    const after = await recordAsync(mainProcess);

    expect([before, after]).toEqual([1, 2]);
    expect(existsSync(path.join(mainProcess.dataDirectory, "modules", "clock", "clock.sqlite"))).toBe(true);
    await mainProcess.checkpointAsync("module-data-restarted");
  });
});
