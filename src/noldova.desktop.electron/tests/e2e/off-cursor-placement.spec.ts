/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { expect, test } from "@playwright/test";

import { OffCursorPlacement, type IPoint, type IRectangle } from "./fixtures/off-cursor-placement.ts";

test.describe("the harness's move of the window off the real cursor", () => {
  const main: IRectangle = { x: 0, y: 0, width: 1920, height: 1080 };
  const left: IRectangle = { x: -1440, y: 0, width: 1440, height: 900 };
  const window: IRectangle = { x: 320, y: 84, width: 1280, height: 800 };
  const menuBar = 25;

  function belowMenuBar(target: IRectangle): IRectangle {
    return { ...target, y: Math.max(target.y, menuBar) };
  }

  function recorder(clamp: (target: IRectangle) => IRectangle): { readonly targets: IRectangle[]; readonly moveAsync: (target: IRectangle) => Promise<IRectangle> } {
    const targets: IRectangle[] = [];
    return {
      targets,
      moveAsync: async target => {
        targets.push(target);
        return clamp(target);
      }
    };
  }

  async function placeAsync(bounds: IRectangle, cursor: IPoint, clamp: (target: IRectangle) => IRectangle = t => t): Promise<{ readonly placed: IRectangle; readonly targets: readonly IRectangle[] }> {
    const moves = recorder(clamp);
    const placed = await OffCursorPlacement.placeAsync(bounds, cursor, [main, left], moves.moveAsync, false);
    return { placed, targets: moves.targets };
  }

  test("a window that does not contain the cursor stays where it is", async () => {
    const result = await placeAsync(window, { x: 100, y: 500 });

    expect(result).toEqual({ placed: window, targets: [] });
  });

  test("the cursor in the middle moves the window by the shortest shift past an edge, nearest first", async () => {
    const cursor = { x: 900, y: 572 };

    const result = await placeAsync(window, cursor);

    expect(OffCursorPlacement.candidates(window, cursor).map(t => [t.x, t.y])).toEqual([[320, -228], [320, 573], [901, 84], [-380, 84]]);
    expect(result.targets).toEqual([{ ...window, y: -228 }]);
    expect(OffCursorPlacement.contains(result.placed, cursor)).toBe(false);
  });

  test("a window that macOS holds below the menu bar is moved by the next shift, and the shifts that failed are not kept", async () => {
    const cursor = { x: 900, y: 572 };

    const result = await placeAsync(window, cursor, belowMenuBar);

    expect(result.targets).toEqual([{ ...window, y: -228 }, { ...window, y: 573 }]);
    expect(result.placed).toEqual({ ...window, y: 573 });
  });

  for (const [name, cursor, shift] of [
    ["left", { x: 320, y: 400 }, { x: 1, y: 0 }],
    ["right", { x: 1599, y: 400 }, { x: -1, y: 0 }],
    ["top", { x: 900, y: 84 }, { x: 0, y: 1 }],
    ["bottom", { x: 900, y: 883 }, { x: 0, y: -1 }]
  ] as const)
    test(`a cursor on the window's ${name} edge moves the window by one pixel`, async () => {
      const result = await placeAsync(window, cursor, belowMenuBar);

      expect(result.targets).toEqual([{ ...window, x: window.x + shift.x, y: window.y + shift.y }]);
      expect(OffCursorPlacement.contains(result.placed, cursor)).toBe(false);
    });

  test("a shift that keeps the window whole on a display goes before a nearer one that takes it past the display's edge", async () => {
    const display: IRectangle = { x: 0, y: 0, width: 2560, height: 1440 };
    const centred: IRectangle = { x: 640, y: 300, width: 1280, height: 800 };
    const cursor = { x: 1280, y: 720 };
    const moves = recorder(t => t);

    const placed = await OffCursorPlacement.placeAsync(centred, cursor, [display], moves.moveAsync, false);

    expect(OffCursorPlacement.candidates(centred, cursor).map(t => [t.x, t.y])).toEqual([[640, -80], [640, 721], [0, 300], [1281, 300]]);
    expect(moves.targets).toEqual([{ ...centred, x: 0 }]);
    expect(OffCursorPlacement.contains(placed, cursor)).toBe(false);
  });

  test("when the window manager refuses both shifts that keep the window whole, the others follow, nearest first", async () => {
    const display: IRectangle = { x: 0, y: 0, width: 2560, height: 1600 };
    const centred: IRectangle = { x: 640, y: 300, width: 1280, height: 800 };
    const cursor = { x: 1280, y: 720 };
    const moves = recorder(t => OffCursorPlacement.fits(t, [display]) ? centred : { ...t, y: Math.max(t.y, 0) });

    const placed = await OffCursorPlacement.placeAsync(centred, cursor, [display], moves.moveAsync, false);

    expect(moves.targets).toEqual([{ ...centred, y: 721 }, { ...centred, x: 0 }, { ...centred, y: -80 }, { ...centred, x: 1281 }]);
    expect(placed).toEqual({ ...centred, x: 1281 });
  });

  test("while a window manager runs on Linux, only the shifts that keep the window whole are tried, since KWin on X11 corrects a move past a display's edge after its bounds answer", async () => {
    const display: IRectangle = { x: 0, y: 0, width: 2560, height: 1440 };
    const centred: IRectangle = { x: 640, y: 300, width: 1280, height: 800 };
    const cursor = { x: 1280, y: 720 };
    const moves = recorder(t => t);

    const placed = await OffCursorPlacement.placeAsync(centred, cursor, [display], moves.moveAsync, true);

    expect(moves.targets).toEqual([{ ...centred, x: 0 }]);
    expect(placed).toEqual({ ...centred, x: 0 });
  });

  test("while a window manager runs on Linux and refuses every shift that keeps the window whole, the window goes back and the move fails at once, naming each refusal", async () => {
    const display: IRectangle = { x: 0, y: 0, width: 2560, height: 1600 };
    const centred: IRectangle = { x: 640, y: 300, width: 1280, height: 800 };
    const moves = recorder(() => centred);

    await expect(OffCursorPlacement.placeAsync(centred, { x: 1280, y: 720 }, [display], moves.moveAsync, true)).rejects.toThrow(
      "The window 640,300 1280x800 cannot be moved off the cursor at 1280,720. Each move left the cursor inside: " +
      "640,721 1280x800 became 640,300 1280x800; 0,300 1280x800 became 640,300 1280x800. Displays: 0,0 2560x1600.");
    expect(moves.targets).toEqual([{ ...centred, y: 721 }, { ...centred, x: 0 }, centred]);
  });

  test("on a display too small for any shift to keep the window whole, while a window manager runs on Linux, the move fails at once without moving the window", async () => {
    const moves = recorder(t => t);

    await expect(OffCursorPlacement.placeAsync({ x: 320, y: 140, width: 1280, height: 800 }, { x: 960, y: 540 }, [main], moves.moveAsync, true)).rejects.toThrow(
      "The window 320,140 1280x800 cannot be moved off the cursor at 960,540. " +
      "No shift past one of its edges keeps it whole on a display, and only such a shift is tried while a window manager runs. Displays: 0,0 1920x1080.");
    expect(moves.targets).toEqual([]);
  });

  test("on a display too small for any shift to keep the window whole, where no window manager runs, as under Xvfb, the others are tried, nearest first, and the move's answer is taken", async () => {
    const centred: IRectangle = { x: 320, y: 140, width: 1280, height: 800 };
    const moves = recorder(t => t);

    const placed = await OffCursorPlacement.placeAsync(centred, { x: 960, y: 540 }, [main], moves.moveAsync, false);

    expect(OffCursorPlacement.candidates(centred, { x: 960, y: 540 }).filter(t => OffCursorPlacement.fits(t, [main]))).toEqual([]);
    expect(moves.targets).toEqual([{ ...centred, y: -260 }]);
    expect(placed).toEqual({ ...centred, y: -260 });
  });

  test("only Linux with a desktop session, which sets XDG_CURRENT_DESKTOP, tries only the shifts that keep the window whole", () => {
    expect([
      OffCursorPlacement.isFittingOnly("linux", { XDG_CURRENT_DESKTOP: "KDE" }),
      OffCursorPlacement.isFittingOnly("linux", {}),
      OffCursorPlacement.isFittingOnly("linux", { XDG_CURRENT_DESKTOP: String.empty }),
      OffCursorPlacement.isFittingOnly("darwin", { XDG_CURRENT_DESKTOP: "KDE" }),
      OffCursorPlacement.isFittingOnly("win32", {})
    ]).toEqual([true, false, false, false, false]);
  });

  test("a window fits a display only while all of it is on one display", () => {
    expect([
      { x: 0, y: 0, width: 1920, height: 1080 },
      { x: -1440, y: 0, width: 1440, height: 900 },
      { x: 1, y: 0, width: 1920, height: 1080 },
      { x: 0, y: -1, width: 1920, height: 1080 },
      { x: -1, y: 100, width: 2, height: 100 },
      { x: -1440, y: 1, width: 1440, height: 900 }
    ].map(t => OffCursorPlacement.fits(t, [main, left]))).toEqual([true, true, false, false, false, false]);
  });

  test("shifts of the same length keep the order right, left, down, up", () => {
    const square: IRectangle = { x: 0, y: 100, width: 100, height: 100 };

    expect(OffCursorPlacement.candidates(square, { x: 50, y: 150 }).map(t => [t.x, t.y])).toEqual([[-50, 100], [0, 50], [51, 100], [0, 151]]);
  });

  test("a cursor on a display left of the main one, at negative coordinates, with the window across both, is cleared by the nearest shift", async () => {
    const across: IRectangle = { x: -1000, y: 100, width: 1280, height: 800 };
    const cursor = { x: -700, y: 400 };

    const result = await placeAsync(across, cursor, belowMenuBar);

    expect(OffCursorPlacement.contains(across, cursor)).toBe(true);
    expect(OffCursorPlacement.contains(result.placed, cursor)).toBe(false);
    expect(result.targets).toEqual([{ ...across, x: -699 }]);
  });

  test("when no shift clears the cursor, the window goes back and the failure names the cursor, the window, each attempt and the displays", async () => {
    const cursor = { x: 900, y: 572 };
    const moves = recorder(() => window);

    await expect(OffCursorPlacement.placeAsync(window, cursor, [main, left], moves.moveAsync, false)).rejects.toThrow(
      "The window 320,84 1280x800 cannot be moved off the cursor at 900,572. Each move left the cursor inside: " +
      "320,-228 1280x800 became 320,84 1280x800; 320,573 1280x800 became 320,84 1280x800; " +
      "901,84 1280x800 became 320,84 1280x800; -380,84 1280x800 became 320,84 1280x800. " +
      "Displays: 0,0 1920x1080; -1440,0 1440x900.");
    expect(moves.targets).toHaveLength(5);
    expect(moves.targets.at(-1)).toEqual(window);
  });
});
