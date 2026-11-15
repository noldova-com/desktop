/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { Locator, Page } from "@playwright/test";

export class TabContentFixture {
  public static of(window: Page, key: string): Locator {
    return window.locator(`[data-tab-content="${key}"]`);
  }

  public static async openAsync(window: Page, key: string): Promise<Locator> {
    await window.locator(`nol-tab[data-tab-key="${key}"]`).click();
    return TabContentFixture.of(window, key);
  }
}
