/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export interface IPoint {
  readonly x: number;
  readonly y: number;
}

export interface IRectangle extends IPoint {
  readonly width: number;
  readonly height: number;
}

export class OffCursorPlacement {
  public static contains(bounds: IRectangle, cursor: IPoint): boolean {
    return cursor.x >= bounds.x && cursor.y >= bounds.y && cursor.x < bounds.x + bounds.width && cursor.y < bounds.y + bounds.height;
  }

  public static candidates(bounds: IRectangle, cursor: IPoint): readonly IRectangle[] {
    const shifts: readonly IPoint[] = [
      { x: cursor.x + 1 - bounds.x, y: 0 },
      { x: cursor.x - bounds.x - bounds.width, y: 0 },
      { x: 0, y: cursor.y + 1 - bounds.y },
      { x: 0, y: cursor.y - bounds.y - bounds.height }
    ];
    return shifts
      .toSorted((a, b) => Math.abs(a.x) + Math.abs(a.y) - Math.abs(b.x) - Math.abs(b.y))
      .map(t => ({ ...bounds, x: bounds.x + t.x, y: bounds.y + t.y }));
  }

  public static fits(bounds: IRectangle, displays: readonly IRectangle[]): boolean {
    return displays.some(t => bounds.x >= t.x && bounds.y >= t.y && bounds.x + bounds.width <= t.x + t.width && bounds.y + bounds.height <= t.y + t.height);
  }

  public static isFittingOnly(platform: string, environment: Readonly<Record<string, string | undefined>>): boolean {
    return platform === "linux" && (environment["XDG_CURRENT_DESKTOP"] ?? String.empty) !== String.empty;
  }

  public static async placeAsync(bounds: IRectangle, cursor: IPoint, displays: readonly IRectangle[], moveAsync: (target: IRectangle) => Promise<IRectangle>,
    fittingOnly: boolean): Promise<IRectangle> {
    if (!OffCursorPlacement.contains(bounds, cursor))
      return bounds;
    const attempts: string[] = [];
    const candidates = OffCursorPlacement.candidates(bounds, cursor);
    const fitting = candidates.filter(t => OffCursorPlacement.fits(t, displays));
    for (const target of fittingOnly ? fitting : [...fitting, ...candidates.filter(t => !OffCursorPlacement.fits(t, displays))]) {
      const actual = await moveAsync(target);
      if (!OffCursorPlacement.contains(actual, cursor))
        return actual;
      attempts.push(`${OffCursorPlacement.describe(target)} became ${OffCursorPlacement.describe(actual)}`);
    }
    if (attempts.length > 0)
      await moveAsync(bounds);
    throw new Error(
      `The window ${OffCursorPlacement.describe(bounds)} cannot be moved off the cursor at ${cursor.x},${cursor.y}. ` +
      (attempts.length > 0 ? `Each move left the cursor inside: ${attempts.join("; ")}. ` : "No shift past one of its edges keeps it whole on a display, and only such a shift is tried while a window manager runs. ") +
      `Displays: ${displays.map(t => OffCursorPlacement.describe(t)).join("; ")}.`);
  }

  public static describe(bounds: IRectangle): string {
    return `${bounds.x},${bounds.y} ${bounds.width}x${bounds.height}`;
  }
}
