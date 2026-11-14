/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Page } from "@playwright/test";

export class MediaFixture {
  public static async emulateAsync(page: Page, media: Parameters<Page["emulateMedia"]>[0]): Promise<void> {
    await page.emulateMedia(media);
    await page.evaluate(async () => {
      document.body.getBoundingClientRect();
      await document.fonts.ready;
    });
  }
}
