/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { page } from "vitest/browser";

import { CanvasContextMissingException } from "../exceptions/canvas-context-missing.exception";
import { InkMissingException } from "../exceptions/ink-missing.exception";

export class InkFixture {
  public static async startAsync(element: Element, later: Element): Promise<number> {
    const shot = new Image();
    shot.src = `data:image/png;base64,${await page.screenshot({ element, save: false })}`;
    await shot.decode();
    const canvas = document.createElement("canvas");
    canvas.width = shot.width;
    canvas.height = shot.height;
    const context = canvas.getContext("2d");
    if (Object.isNull(context))
      throw new CanvasContextMissingException();
    context.drawImage(shot, 0, 0);
    const pixels = context.getImageData(0, 0, shot.width, shot.height);
    const box = element.getBoundingClientRect();
    const part = later.getBoundingClientRect();
    const ratio = devicePixelRatio;
    const originX = Math.floor(box.left * ratio);
    const originY = Math.floor(box.top * ratio);
    const first = Math.ceil(box.left * ratio) - originX;
    const columns = Array.from({ length: Math.max(0, Math.floor(part.left * ratio) - originX - first) }, (_, i) => first + i);
    const rows = Array.from({ length: Math.floor(part.bottom * ratio) - Math.ceil(part.top * ratio) }, (_, i) => Math.ceil(part.top * ratio) - originY + i);
    const difference = (x: number, y: number): number => {
      const at = (y * pixels.width + x) * 4;
      const edge = (y * pixels.width + first) * 4;
      return Math.max(...[0, 1, 2].map(t => Math.abs((pixels.data[at + t] ?? 0) - (pixels.data[edge + t] ?? 0))));
    };
    const strongest = Math.max(0, ...columns.flatMap(x => rows.map(y => difference(x, y))));
    const found = columns.find(x => rows.some(y => difference(x, y) > strongest / 2));
    if (Object.isUndefined(found))
      throw new InkMissingException();
    return (originX + found) / ratio;
  }
}
