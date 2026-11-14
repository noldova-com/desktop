/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Locator, type Page, expect } from "@playwright/test";

import { MediaFixture } from "./media.fixture.ts";
import { PageBridgeFixture } from "./page-bridge.fixture.ts";

export type WindowMode = "Light" | "Dark";

export class WindowModeFixture {
  public static readonly modes: readonly WindowMode[] = ["Light", "Dark"];
  public static readonly backgrounds: Readonly<Record<WindowMode, string>> = { Light: "rgb(248, 248, 248)", Dark: "rgb(24, 24, 24)" };
  public static readonly strongTexts: Readonly<Record<WindowMode, string>> = { Light: "rgb(59, 59, 59)", Dark: "rgb(204, 204, 204)" };

  public static async setAsync(window: Page, mode: WindowMode): Promise<void> {
    await PageBridgeFixture.evaluateAsync(window, (t, value) => t.request("desktop.setSetting", { name: "desktop.mode", value }), mode);
    await expect.poll(() => window.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(WindowModeFixture.backgrounds[mode]);
  }

  public static async expectStrongTextAsync(window: Page, ...titles: Locator[]): Promise<void> {
    for (const mode of WindowModeFixture.modes) {
      await MediaFixture.emulateAsync(window, { colorScheme: mode === "Light" ? "light" : "dark" });
      for (const title of titles)
        await expect(title).toHaveCSS("color", WindowModeFixture.strongTexts[mode]);
    }
    await MediaFixture.emulateAsync(window, { forcedColors: "active" });
    const canvasText = await window.evaluate(() => {
      const probe = document.body.appendChild(document.createElement("span"));
      probe.style.color = "CanvasText";
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    for (const title of titles)
      await expect(title).toHaveCSS("color", canvasText);
    await MediaFixture.emulateAsync(window, { colorScheme: null, forcedColors: null });
  }
}
