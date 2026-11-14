/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import { MainProcessFixture } from "./fixtures/main-process.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test.use({ mainProcessVariant: BuildVariantFixture.noModules });

test.describe("restarting", () => {
  test.use({ mainProcessEnvironment: { NOLDOVA_DESKTOP_UI_PROBE: "restart" } });

  test("Noldova Desktop Sample opens again on the same profile and environment after a clean close @smoke", async ({ mainProcess }) => {
    const readLaunch = (): Promise<readonly string[]> => mainProcess.application.evaluate(({ app }) => [app.getPath("userData"), process.env["NOLDOVA_DESKTOP_UI_PROBE"] ?? ""]);
    const before = await readLaunch();

    await mainProcess.restartAsync();

    expect(await readLaunch()).toEqual(before);
    expect(before[1]).toBe("restart");
    await expect(mainProcess.window.locator("nol-empty-window")).toHaveText(/Noldova Desktop Sample\s*No modules/);
    await mainProcess.checkpointAsync("restart-reopened");
  });

  test("Noldova Desktop Sample quit and reopened stops its idle runtime as it quits and starts a new one @smoke", async ({ mainProcess }) => {
    const runtime = await mainProcess.readRuntimeProcessIdAsync();

    await mainProcess.reopenAsync();

    expect(mainProcess.closeMilliseconds, "the close finishes without waiting for the runtime to exit").toBeLessThan(10_000);
    expect(runtime).toBeDefined();
    await expect.poll(() => MainProcessFixture.isAlive(runtime ?? 0), { timeout: 30_000 }).toBe(false);
    expect(await mainProcess.readRuntimeProcessIdAsync()).not.toBe(runtime);
    await expect(mainProcess.window.locator("nol-empty-window")).toHaveText(/Noldova Desktop Sample\s*No modules/);
  });
});
