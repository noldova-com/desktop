/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";
import { MediaFixture } from "./fixtures/media.fixture.ts";
import { WindowModeFixture } from "./fixtures/window-mode.fixture.ts";

test.use({ mainProcessDataFiles: { "modules/notes/welcome": String.empty } });

function note(window: Page, id: number): Locator {
  return window.locator(`nol-tab[data-tab-key="document/notes.note/${id}"]`);
}

test.describe("placeholder", () => {
  test("a module's placeholder shows where a document's page shows while no document is open, takes the focus from the last one closed, stays visible in light, dark and forced colors, and goes once a document opens", async ({ mainProcess }) => {
    const window = mainProcess.window;
    const placeholder = window.locator("nol-placeholder-content");
    const button = placeholder.getByRole("button", { name: "New note" });
    await expect(note(window, 1)).toBeVisible();
    await expect(placeholder).toHaveCount(0);
    await note(window, 2).click();
    const page = await window.locator("[data-tab-content=\"document/notes.note/2\"]").boundingBox();

    for (const id of [2, 1]) {
      await note(window, id).focus();
      await window.keyboard.press("ControlOrMeta+KeyW");
      await expect(note(window, id)).toHaveCount(0);
    }

    await expect(button).toBeFocused();
    await expect(window.locator("nol-empty-window")).toHaveCount(0);
    const placed = await placeholder.boundingBox();
    expect(page).not.toBeNull();
    for (const key of ["x", "y", "width", "height"] as const)
      expect(Math.abs((placed?.[key] ?? Number.NaN) - (page?.[key] ?? Number.NaN)), key).toBeLessThanOrEqual(1);
    await mainProcess.checkpointAsync("placeholder-light");
    await WindowModeFixture.setAsync(window, "Dark");
    await mainProcess.checkpointAsync("placeholder-dark");
    await WindowModeFixture.setAsync(window, "Light");
    await MediaFixture.emulateAsync(window, { forcedColors: "active", colorScheme: "light" });
    await expect(button).toBeVisible();
    await mainProcess.checkpointAsync("placeholder-forced-colors");
    await MediaFixture.emulateAsync(window, { forcedColors: "none" });

    await button.focus();
    await window.keyboard.press("Enter");

    await expect(note(window, 3)).toHaveAttribute("aria-selected", "true");
    await expect(placeholder).toHaveCount(0);
  });
});
