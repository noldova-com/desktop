/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator } from "@playwright/test";

import { CommandSearchFixture } from "./fixtures/command-search.fixture.ts";
import { expect, test } from "./fixtures/main-process-test.fixture.ts";

const expectInsideAsync = async (inner: Locator, outer: { x: number; y: number; width: number; height: number } | null): Promise<void> => {
  const box = await inner.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(0);
  expect(box?.height ?? 0).toBeGreaterThan(0);
  expect(outer).not.toBeNull();
  expect(box?.x ?? 0).toBeGreaterThanOrEqual((outer?.x ?? 0) - 0.5);
  expect(box?.y ?? 0).toBeGreaterThanOrEqual((outer?.y ?? 0) - 0.5);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((outer?.x ?? 0) + (outer?.width ?? 0) + 0.5);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((outer?.y ?? 0) + (outer?.height ?? 0) + 0.5);
};

test.describe("a window part from a package of its own", () => {
  test("shows the beacon's view, built against the app's one copy of the window package", async ({ mainProcess }) => {
    const window = mainProcess.window;

    await CommandSearchFixture.searchAsync(window, "Show the beacon's signal");
    await window.keyboard.press("Enter");
    const dialog = window.getByRole("dialog");
    await expect(dialog.locator("[data-fixture-content=beacon-signal]")).toHaveText("The beacon's window part came from its own package.");
    const content = await dialog.locator(".nol-view-dialog-content").boundingBox();
    await expectInsideAsync(dialog.locator("[data-fixture-content=beacon-signal]"), content);
  });
});
