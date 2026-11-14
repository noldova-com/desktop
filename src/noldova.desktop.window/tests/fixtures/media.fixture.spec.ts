/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MediaFixture } from "./media.fixture";

describe("MediaFixture", () => {
  it("returns from each switch of forced colors with the kit's fonts loaded and text laid out in them, as wide as before the switch", async () => {
    const text = document.body.appendChild(document.createElement("span"));
    text.style.fontFamily = "var(--nol-font-sans)";
    text.style.fontSize = "0.75rem";
    text.textContent = "Chats 3 Messages 1 Commands 2";
    const measure = (): readonly unknown[] => [text.getBoundingClientRect().width, document.fonts.status];
    try {
      const before = measure();
      await MediaFixture.forceColorsAsync("active");
      const forced = measure();
      await MediaFixture.forceColorsAsync("none");

      expect([forced, measure()]).toEqual([before, before]);
      expect(before[1]).toBe("loaded");
    }
    finally {
      text.remove();
      await MediaFixture.forceColorsAsync("none");
    }
  });
});
