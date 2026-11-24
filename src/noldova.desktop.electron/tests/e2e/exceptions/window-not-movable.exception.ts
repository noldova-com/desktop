/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ElectronException } from "@noldova/desktop.electron";

export class WindowNotMovableException extends ElectronException {
  public readonly bounds: string;
  public readonly cursor: string;
  public readonly attempts: readonly string[];
  public readonly displays: readonly string[];

  public constructor(bounds: string, cursor: string, attempts: readonly string[], displays: readonly string[]) {
    super(`The window ${bounds} cannot be moved off the cursor at ${cursor}. ` +
      (attempts.length > 0 ? `Each move left the cursor inside: ${attempts.join("; ")}. ` : "No shift past one of its edges keeps it whole on a display, and only such a shift is tried while a window manager runs. ") +
      `Displays: ${displays.join("; ")}.`);

    this.bounds = bounds;
    this.cursor = cursor;
    this.attempts = attempts;
    this.displays = displays;
  }
}
