/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { Locator, Page } from "@playwright/test";

export class InkFixture {
  public static async startsAsync(window: Page, elements: Locator, later: string): Promise<readonly number[]> {
    const starts: number[] = [];
    for (const element of await elements.all())
      starts.push(await InkFixture.startAsync(window, element, element.locator(later)));
    return starts;
  }

  public static async startAsync(window: Page, element: Locator, later: Locator): Promise<number> {
    await element.scrollIntoViewIfNeeded();
    const box = await InkFixture.boxAsync(element);
    const part = await InkFixture.boxAsync(later);
    const shot = await window.screenshot();
    const found = await window.evaluate(async ({ data, left, right, top, bottom }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (context === null)
        throw new Error("The canvas has no 2D context.");
      context.drawImage(image, 0, 0);
      const ratio = image.naturalWidth / innerWidth;
      const [first, stop] = [Math.ceil(left * ratio), Math.floor(right * ratio)];
      const [high, low] = [Math.ceil(top * ratio), Math.floor(bottom * ratio)];
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const columns = Array.from({ length: Math.max(0, stop - first) }, (_, i) => first + i);
      const rows = Array.from({ length: Math.max(0, low - high) }, (_, i) => high + i);
      const difference = (x: number, y: number): number => {
        const [at, edge] = [(y * pixels.width + x) * 4, (y * pixels.width + first) * 4];
        return Math.max(...[0, 1, 2].map(t => Math.abs((pixels.data[at + t] ?? 0) - (pixels.data[edge + t] ?? 0))));
      };
      const strongest = Math.max(0, ...columns.flatMap(x => rows.map(y => difference(x, y))));
      const column = columns.find(x => rows.some(y => difference(x, y) > strongest / 2));
      return column === undefined ? null : column / ratio;
    }, {
      data: shot.toString("base64"),
      left: box.left,
      right: part.left,
      top: part.top,
      bottom: part.bottom
    });
    if (Object.isNull(found))
      throw new Error("The element holds no ink before its later part.");
    return found;
  }

  private static boxAsync(element: Locator): Promise<Readonly<Record<"left" | "top" | "right" | "bottom", number>>> {
    return element.evaluate(t => {
      const box = t.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    });
  }
}
