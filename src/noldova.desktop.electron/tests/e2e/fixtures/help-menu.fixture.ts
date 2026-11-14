/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ElectronApplication, type Locator, type Page, expect } from "@playwright/test";

export class HelpMenuFixture {
  private static readonly TITLE: string = "Help";
  private static readonly ROWS: string = "button[nol-menu-item], nol-menu-separator";

  public static async openInWindowAsync(window: Page): Promise<Locator> {
    await window.locator("nol-menu-bar").getByRole("menuitem", { name: HelpMenuFixture.TITLE }).click();
    const menu = window.locator(".cdk-overlay-container nol-menu[data-place=\"desktop.help\"]");
    await expect(menu).toBeVisible();
    return menu;
  }

  public static async expectRowsAsync(menu: Locator, rows: readonly (string | RegExp)[]): Promise<void> {
    const found = menu.locator(HelpMenuFixture.ROWS);
    await expect(found).toHaveText([...rows]);
    const boxes = await Promise.all((await found.all()).map(t => t.boundingBox()));
    const gaps = boxes.slice(1).map((t, i) => (t?.y ?? Number.NaN) - ((boxes[i]?.y ?? Number.NaN) + (boxes[i]?.height ?? Number.NaN)));
    expect(gaps.every(t => t >= -0.5)).toBe(true);
  }

  public static readNativeHelpAsync(application: ElectronApplication): Promise<readonly string[]> {
    return application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items.find(t => t.role === "help")?.submenu?.items.map(t => t.type === "separator" ? "" : t.label) ?? []);
  }

  public static readNativeApplicationAsync(application: ElectronApplication): Promise<readonly string[]> {
    return application.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items[0]?.submenu?.items.map(t => t.type === "separator" ? "" : t.label) ?? []);
  }
}
