/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { OlderRuntimeFixture } from "./fixtures/older-runtime.fixture.ts";
import { BuildVariantFixture } from "./fixtures/build-variant.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { PageBridgeFixture } from "./fixtures/page-bridge.fixture.ts";
import { TestRoots } from "./fixtures/test-roots.ts";

test.use({ mainProcessVariant: BuildVariantFixture.noModules });

test.describe("data from before the shell", () => {
  test.use({ mainProcessDataFiles: { "conversations.json": "[]" } });

  test("Noldova Desktop Sample explains the refusal and moves the data aside when asked", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await expect(window.getByRole("heading", { name: "Data from an earlier Noldova Desktop Sample" })).toBeVisible();
    await expect(window.locator("nol-workspace")).toHaveCount(0);
    await mainProcess.checkpointAsync("pre-shell-refusal");
    await window.getByRole("button", { name: "Move aside" }).click();

    await expect(window.locator("nol-empty-window")).toHaveText(/Noldova Desktop Sample\s*No modules/);
    const siblings = (await readdir(mainProcess.root)).filter(t => t !== "data" && t !== "device" && t !== TestRoots.MARKER);
    expect(siblings.length).toBe(1);
    expect(existsSync(path.join(mainProcess.root, siblings[0] ?? String.empty, "conversations.json"))).toBe(true);
    expect(existsSync(path.join(mainProcess.dataDirectory, "conversations.json"))).toBe(false);
    expect(existsSync(path.join(mainProcess.dataDirectory, "main"))).toBe(true);
  });
});

test.describe("builds", () => {
  test("a newer build takes over the data directory from an older build's runtime", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-empty-window")).toHaveText(/Noldova Desktop Sample\s*No modules/);
    const older: OlderRuntimeFixture[] = [];
    try {
      await mainProcess.restartAsync(async () => {
        older.push(await OlderRuntimeFixture.startAsync(mainProcess.dataDirectory));
      });

      await expect(mainProcess.window.locator("nol-empty-window")).toHaveText(/Noldova Desktop Sample\s*No modules/);
      await expect.poll(() => older.every(t => t.hasExited) && older.length === 1).toBe(true);
    }
    finally {
      for (const runtime of older)
        await runtime.disposeAsync();
    }
  });
});

test.describe("requests from the window", () => {
  test("the window asks the runtime for its modules and may not stop it", async ({ mainProcess }) => {
    await expect(mainProcess.window.locator("nol-empty-window")).toBeVisible();
    const modules = await PageBridgeFixture.answerAsync(mainProcess.window, "desktop.modules", null);
    const stop = await PageBridgeFixture.answerAsync(mainProcess.window, "desktop.stop", { policy: "IfIdle" });

    expect(Array.isArray(modules.readObject("payload").readValue("modules"))).toBe(true);
    expect(stop.readObject("failure").readString("code")).toBe("Unauthorized");
    expect(await mainProcess.readRuntimeProcessIdAsync()).toBeDefined();
  });
});
