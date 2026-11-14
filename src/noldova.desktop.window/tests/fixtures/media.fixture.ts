/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {} from "@vitest/browser-playwright";
import { cdp } from "vitest/browser";

export class MediaFixture {
  public static async emulateAsync(features: readonly (readonly [string, string])[]): Promise<void> {
    await cdp().send("Emulation.setEmulatedMedia", { features: features.map(([name, value]) => ({ name, value })) });
    document.body.getBoundingClientRect();
    await document.fonts.ready;
  }

  public static forceColorsAsync(value: string): Promise<void> {
    return MediaFixture.emulateAsync([["forced-colors", value]]);
  }
}
