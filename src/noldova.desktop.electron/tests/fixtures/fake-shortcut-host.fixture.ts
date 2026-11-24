/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { IShortcutHost } from "@noldova/desktop.electron";

import { ShortcutNotTakenException } from "../exceptions/shortcut-not-taken.exception.js";

export class FakeShortcutHost implements IShortcutHost {
  public readonly held: Map<string, () => void> = new Map();
  public readonly steps: string[] = [];
  public readonly refused: Set<string> = new Set();
  public failure: Error | null = null;

  public register(accelerator: string, callback: () => void): boolean {
    this.steps.push(`take ${accelerator}`);
    if (!Object.isNull(this.failure))
      throw this.failure;
    if (this.refused.has(accelerator) || this.held.has(accelerator))
      return false;
    this.held.set(accelerator, callback);
    return true;
  }

  public unregister(accelerator: string): void {
    this.steps.push(`release ${accelerator}`);
    this.held.delete(accelerator);
  }

  public press(accelerator: string): void {
    const callback = this.held.get(accelerator);
    if (Object.isUndefined(callback))
      throw new ShortcutNotTakenException(accelerator);
    callback();
  }
}
