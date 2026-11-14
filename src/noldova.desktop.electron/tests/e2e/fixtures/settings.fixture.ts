/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Page, expect } from "@playwright/test";

export class SettingsFixture {
  private static readonly KEY: string = "ControlOrMeta+Comma";
  private static readonly GALLERY: string = "Gallery";
  private static readonly PAGES: string = "Settings pages";

  public static async openAsync(window: Page): Promise<void> {
    await window.locator("nol-workspace").click({ position: { x: 4, y: 4 } });
    await window.keyboard.press(SettingsFixture.KEY);
    await expect(window.locator("nol-settings")).toBeVisible();
  }

  public static async openPageAsync(window: Page, title: string): Promise<void> {
    await SettingsFixture.openAsync(window);
    await SettingsFixture.choosePageAsync(window, title);
  }

  public static async choosePageAsync(window: Page, title: string): Promise<void> {
    const settings = window.locator("nol-settings");
    const select = settings.locator(".nol-settings-page-select").getByRole("button");
    const page = settings.locator(".nol-settings-pages").getByRole("treeitem", { name: title, exact: true, includeHidden: true });
    if (await select.isVisible()) {
      await select.click();
      await window.getByRole("listbox", { name: SettingsFixture.PAGES }).getByRole("option", { name: title, exact: true }).click();
    } else
      await page.click();
    await expect(page).toHaveAttribute("aria-selected", "true");
  }

  public static async openGalleryAsync(window: Page): Promise<void> {
    await SettingsFixture.openPageAsync(window, SettingsFixture.GALLERY);
    await expect(window.locator("nol-gallery")).toBeVisible();
  }
}
