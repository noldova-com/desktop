/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Page, expect } from "@playwright/test";

export class CommandSearchFixture {
  private static readonly KEY: string = "ControlOrMeta+Shift+KeyP";
  private static readonly FIELD: RegExp = /^Search /;

  public static async searchAsync(window: Page, text: string): Promise<void> {
    await window.keyboard.press(CommandSearchFixture.KEY);
    const field = window.getByRole("combobox", { name: CommandSearchFixture.FIELD });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue(">");
    await window.keyboard.press("End");
    await window.keyboard.type(text);
  }
}
